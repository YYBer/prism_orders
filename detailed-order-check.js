#!/usr/bin/env node

const { ethers } = require('ethers');
require('dotenv').config();

async function detailedOrderCheck() {
  try {
    console.log('🔍 Detailed Order Status Check');
    console.log('==============================\n');
    
    const chainId = process.env.CHAIN_ID || '8453';
    const apiKey = process.env.ONEINCH_API_KEY;
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || 'https://base.llamarpc.com';
    
    if (!apiKey || !privateKey) {
      console.error('❌ Missing API key or private key');
      return;
    }
    
    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    
    console.log(`👤 Wallet: ${walletAddress}`);
    console.log(`🌐 Chain ID: ${chainId}`);
    console.log(`🔗 RPC: ${rpcUrl}\n`);
    
    // Get orders from API - try multiple endpoint formats
    const endpoints = [
      `https://api.1inch.dev/orderbook/v4.0/${chainId}/orders?maker=${walletAddress}&limit=50`,
      `https://api.1inch.dev/orderbook/v4.0/${chainId}/limit-order/orders?maker=${walletAddress}&limit=50`,
      `https://api.1inch.dev/orderbook/v4.0/${chainId}/order?maker=${walletAddress}&limit=50`
    ];
    
    let orders = [];
    let workingUrl = null;
    
    for (const url of endpoints) {
      console.log(`🔄 Trying: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'accept': 'application/json'
          }
        });
        
        console.log(`📊 Status: ${response.status}`);
        
        if (response.ok) {
          orders = await response.json();
          workingUrl = url;
          console.log(`✅ Success with: ${url}\n`);
          break;
        } else {
          const errorText = await response.text();
          console.log(`❌ Error: ${errorText}\n`);
        }
      } catch (error) {
        console.log(`❌ Request failed: ${error.message}\n`);
      }
    }
    
    if (!workingUrl) {
      console.log('❌ All API endpoints failed. Let me try the SDK approach...');
      
      // Try using the 1inch SDK directly
      try {
        const { Api, FetchProviderConnector, Address } = require('@1inch/limit-order-sdk');
        
        const oneInchApi = new Api({
          networkId: parseInt(chainId),
          authKey: apiKey,
          httpConnector: new FetchProviderConnector()
        });
        
        console.log('🔄 Using 1inch SDK...');
        const sdkOrders = await oneInchApi.getOrdersByMaker(new Address(walletAddress));
        
        if (Array.isArray(sdkOrders)) {
          orders = sdkOrders;
          console.log(`✅ SDK Success: Found ${orders.length} orders\n`);
        } else {
          console.log('❌ SDK returned unexpected format');
          return;
        }
        
      } catch (sdkError) {
        console.log(`❌ SDK also failed: ${sdkError.message}`);
        console.log('\n💡 This might indicate:');
        console.log('• API key issues');
        console.log('• Network connectivity problems');
        console.log('• Rate limiting');
        console.log('• Orders were created with a different tool/wallet');
        return;
      }
    }
    console.log(`📊 Found ${orders.length} orders\n`);
    
    if (orders.length === 0) {
      console.log('No orders found');
      return;
    }
    
    // Analyze each order in detail
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`\n📋 ORDER ${i + 1}: ${order.orderHash}`);
      console.log('=' .repeat(60));
      
      // Basic status
      console.log(`📅 Created: ${order.createDateTime ? new Date(order.createDateTime).toLocaleString() : 'Unknown'}`);
      console.log(`❌ Invalid Reason: ${order.orderInvalidReason || 'None'}`);
      console.log(`💰 Fillable Balance: ${order.fillableBalance || 'Unknown'}`);
      console.log(`🏷️  Remaining Maker Amount: ${order.remainingMakerAmount || 'Unknown'}`);
      console.log(`💳 Maker Balance: ${order.makerBalance || 'Unknown'}`);
      console.log(`✅ Maker Allowance: ${order.makerAllowance || 'Unknown'}`);
      
      // Order data analysis
      if (order.data) {
        console.log(`\n📊 Order Details:`);
        console.log(`   Maker: ${order.data.maker}`);
        console.log(`   Maker Asset: ${order.data.makerAsset}`);
        console.log(`   Taker Asset: ${order.data.takerAsset}`);
        console.log(`   Making Amount: ${order.data.makingAmount}`);
        console.log(`   Taking Amount: ${order.data.takingAmount}`);
        console.log(`   Salt: ${order.data.salt}`);
        
        // Check if maker matches wallet
        if (order.data.maker.toLowerCase() !== walletAddress.toLowerCase()) {
          console.log(`⚠️  WARNING: Maker address doesn't match wallet!`);
        }
        
        // Calculate price
        try {
          const makingAmount = ethers.BigNumber.from(order.data.makingAmount);
          const takingAmount = ethers.BigNumber.from(order.data.takingAmount);
          const price = takingAmount.mul(ethers.utils.parseEther('1')).div(makingAmount);
          console.log(`   💱 Price: ${ethers.utils.formatEther(price)} taker tokens per maker token`);
        } catch (e) {
          console.log(`   💱 Price: Could not calculate`);
        }
      }
      
      // Check token balances on-chain
      console.log(`\n🔍 On-Chain Verification:`);
      
      if (order.data && order.data.makerAsset) {
        try {
          // Check maker token balance
          const tokenABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
          const tokenContract = new ethers.Contract(order.data.makerAsset, tokenABI, provider);
          
          const balance = await tokenContract.balanceOf(walletAddress);
          const decimals = await tokenContract.decimals();
          const symbol = await tokenContract.symbol();
          
          console.log(`   💰 Current ${symbol} balance: ${ethers.utils.formatUnits(balance, decimals)}`);
          
          // Check if we have enough balance for this order
          const makingAmount = ethers.BigNumber.from(order.data.makingAmount);
          const hasEnoughBalance = balance.gte(makingAmount);
          
          console.log(`   📊 Required for order: ${ethers.utils.formatUnits(makingAmount, decimals)} ${symbol}`);
          console.log(`   ✅ Sufficient balance: ${hasEnoughBalance ? 'YES' : 'NO'}`);
          
          if (!hasEnoughBalance) {
            console.log(`   ⚠️  INSUFFICIENT BALANCE - This might be why fillableBalance is 0!`);
          }
          
          // Check allowance to 1inch
          const allowanceABI = ['function allowance(address owner, address spender) view returns (uint256)'];
          const allowanceContract = new ethers.Contract(order.data.makerAsset, allowanceABI, provider);
          const limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65'; // 1inch v4
          
          const allowance = await allowanceContract.allowance(walletAddress, limitOrderProtocol);
          console.log(`   🔓 1inch allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
          
          const hasEnoughAllowance = allowance.gte(makingAmount);
          console.log(`   ✅ Sufficient allowance: ${hasEnoughAllowance ? 'YES' : 'NO'}`);
          
          if (!hasEnoughAllowance) {
            console.log(`   ⚠️  INSUFFICIENT ALLOWANCE - This might be why fillableBalance is 0!`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking on-chain data: ${error.message}`);
        }
      }
      
      // Determine likely status
      console.log(`\n🎯 Likely Status:`);
      if (order.orderInvalidReason) {
        console.log(`   ❌ CANCELLED/INVALID: ${order.orderInvalidReason}`);
      } else if (order.fillableBalance === '0' || order.fillableBalance === 0) {
        console.log(`   🤔 ZERO FILLABLE BALANCE - Could be:`);
        console.log(`      • ✅ Completely filled (executed)`);
        console.log(`      • 💰 Insufficient token balance`);
        console.log(`      • 🔓 Insufficient allowance`);
        console.log(`      • ⏰ Expired`);
        console.log(`      • 📊 Price conditions not met`);
      } else {
        console.log(`   🟢 ACTIVE - Waiting for execution`);
      }
      
      console.log(`\n${'='.repeat(60)}`);
    }
    
    // Summary
    console.log(`\n📈 SUMMARY:`);
    console.log(`Total Orders: ${orders.length}`);
    
    const withZeroFillable = orders.filter(o => o.fillableBalance === '0' || o.fillableBalance === 0);
    const withInvalidReason = orders.filter(o => o.orderInvalidReason);
    const active = orders.filter(o => !o.orderInvalidReason && o.fillableBalance && o.fillableBalance !== '0');
    
    console.log(`Zero Fillable Balance: ${withZeroFillable.length}`);
    console.log(`With Invalid Reason: ${withInvalidReason.length}`);
    console.log(`Potentially Active: ${active.length}`);
    
    console.log(`\n💡 Next Steps:`);
    console.log(`• Check your token balances above`);
    console.log(`• If balance/allowance issues, that's why fillableBalance=0`);
    console.log(`• Visit https://app.1inch.io/ to see order status in UI`);
    console.log(`• Check transaction history for any fills`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

detailedOrderCheck();
#!/usr/bin/env node

const { ethers } = require('ethers');
require('dotenv').config();

// Import the compiled DCA class
const { HodlLadderDCA } = require('./dist/dca.js');

async function sdkOrderCheck() {
  try {
    console.log('🔍 SDK Order Check (Using Same Method as DCA)');
    console.log('==============================================\n');
    
    const chainId = process.env.CHAIN_ID || '8453';
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || 'https://base.llamarpc.com';
    
    if (!privateKey) {
      console.error('❌ Missing private key');
      return;
    }
    
    // Setup exactly like the DCA class
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const walletAddress = signer.address;
    
    console.log(`👤 Wallet: ${walletAddress}`);
    console.log(`🌐 Chain ID: ${chainId}`);
    console.log(`🔗 RPC: ${rpcUrl}\n`);
    
    // Initialize DCA strategy (same as your working code)
    const dcaStrategy = new HodlLadderDCA(provider, signer);
    
    console.log('🔄 Getting orders using DCA method...');
    
    // Use the exact same method that works in your code
    const orders = await dcaStrategy.getActiveOrdersFromAPI();
    
    console.log(`📊 Found ${orders.length} orders via DCA method\n`);
    
    if (orders.length === 0) {
      console.log('ℹ️  No orders found using DCA method.');
      
      // Let's also try the raw SDK method
      console.log('\n🔄 Trying raw SDK method...');
      
      const { Api, FetchProviderConnector, Address } = require('./node_modules/@1inch/limit-order-sdk');
      
      const oneInchApi = new Api({
        networkId: parseInt(chainId),
        authKey: process.env.ONEINCH_API_KEY,
        httpConnector: new FetchProviderConnector()
      });
      
      const rawOrders = await oneInchApi.getOrdersByMaker(new Address(walletAddress));
      console.log(`📊 Raw SDK returned ${rawOrders?.length || 0} orders`);
      
      if (rawOrders && rawOrders.length > 0) {
        console.log('\n📄 Raw orders (before filtering):');
        rawOrders.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.orderHash?.slice(0, 10)}... - Invalid: ${order.orderInvalidReason || 'None'} - Fillable: ${order.fillableBalance || 'Unknown'}`);
        });
      }
      
      return;
    }
    
    // Analyze each order
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`\n📋 ORDER ${i + 1}: ${order.orderHash}`);
      console.log('='.repeat(60));
      
      console.log(`📅 Created: ${order.createDateTime ? new Date(order.createDateTime).toLocaleString() : 'Unknown'}`);
      console.log(`❌ Invalid Reason: ${order.orderInvalidReason || 'None'}`);
      console.log(`💰 Fillable Balance: ${order.fillableBalance || 'Unknown'}`);
      
      // Check the actual order data
      if (order.data) {
        console.log(`\n📊 Order Details:`);
        console.log(`   Maker: ${order.data.maker}`);
        console.log(`   Maker Asset: ${order.data.makerAsset}`);
        console.log(`   Taker Asset: ${order.data.takerAsset}`);
        console.log(`   Making Amount: ${order.data.makingAmount}`);
        console.log(`   Taking Amount: ${order.data.takingAmount}`);
        
        // Check token balances
        console.log(`\n🔍 Token Balance Check:`);
        
        try {
          const tokenABI = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function allowance(address owner, address spender) view returns (uint256)'
          ];
          
          const tokenContract = new ethers.Contract(order.data.makerAsset, tokenABI, provider);
          
          const balance = await tokenContract.balanceOf(walletAddress);
          const decimals = await tokenContract.decimals();
          const symbol = await tokenContract.symbol();
          
          console.log(`   💰 Current ${symbol} balance: ${ethers.utils.formatUnits(balance, decimals)}`);
          
          const makingAmount = ethers.BigNumber.from(order.data.makingAmount.toString());
          console.log(`   📊 Required for order: ${ethers.utils.formatUnits(makingAmount, decimals)} ${symbol}`);
          
          const hasEnoughBalance = balance.gte(makingAmount);
          console.log(`   ✅ Sufficient balance: ${hasEnoughBalance ? 'YES' : 'NO ⚠️'}`);
          
          // Check allowance
          const limitOrderProtocol = '0x111111125421cA6dc452d289314280a0f8842A65';
          const allowance = await tokenContract.allowance(walletAddress, limitOrderProtocol);
          console.log(`   🔓 1inch allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
          
          const hasEnoughAllowance = allowance.gte(makingAmount);
          console.log(`   ✅ Sufficient allowance: ${hasEnoughAllowance ? 'YES' : 'NO ⚠️'}`);
          
          // Determine why fillableBalance might be 0
          console.log(`\n🎯 Analysis:`);
          if (!hasEnoughBalance) {
            console.log(`   ⚠️  PROBLEM: Insufficient token balance!`);
            console.log(`       You need ${ethers.utils.formatUnits(makingAmount.sub(balance), decimals)} more ${symbol}`);
          }
          
          if (!hasEnoughAllowance) {
            console.log(`   ⚠️  PROBLEM: Insufficient allowance!`);
            console.log(`       Need to approve ${ethers.utils.formatUnits(makingAmount, decimals)} ${symbol} to 1inch`);
          }
          
          if (hasEnoughBalance && hasEnoughAllowance) {
            console.log(`   🤔 Balance and allowance are sufficient, but fillableBalance is still 0`);
            console.log(`   📋 Possible reasons:`);
            console.log(`       • Order was actually filled (check transaction history)`);
            console.log(`       • Order expired`);
            console.log(`       • Price conditions not met`);
            console.log(`       • Network/API sync issues`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking token: ${error.message}`);
        }
      }
      
      console.log(`\n${'='.repeat(60)}`);
    }
    
    console.log(`\n💡 Summary:`);
    console.log(`• Found ${orders.length} orders with fillableBalance=0`);
    console.log(`• Check the analysis above for specific issues`);
    console.log(`• Visit https://app.1inch.io/ to see order status in UI`);
    console.log(`• If balance/allowance issues, fix those first`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure you have run:');
    console.log('npm run build');
  }
}

sdkOrderCheck();
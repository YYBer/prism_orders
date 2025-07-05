#!/usr/bin/env node

const { ethers } = require('ethers');
require('dotenv').config();

async function rawOrderAnalysis() {
  try {
    console.log('🔍 Raw Order Analysis');
    console.log('====================\n');
    
    const chainId = process.env.CHAIN_ID || '8453';
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || 'https://base.llamarpc.com';
    
    if (!privateKey) {
      console.error('❌ Missing private key');
      return;
    }
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const walletAddress = signer.address;
    
    console.log(`👤 Wallet: ${walletAddress}`);
    console.log(`🌐 Chain ID: ${chainId}\n`);
    
    // Use raw SDK method to get unfiltered orders
    const { Api, FetchProviderConnector, Address } = require('./node_modules/@1inch/limit-order-sdk');
    
    const oneInchApi = new Api({
      networkId: parseInt(chainId),
      authKey: process.env.ONEINCH_API_KEY,
      httpConnector: new FetchProviderConnector()
    });
    
    console.log('📡 Fetching raw orders from 1inch SDK...');
    const rawOrders = await oneInchApi.getOrdersByMaker(new Address(walletAddress));
    
    console.log(`📊 Found ${rawOrders?.length || 0} raw orders\n`);
    
    if (!rawOrders || rawOrders.length === 0) {
      console.log('No orders found');
      return;
    }
    
    // Analyze each raw order
    for (let i = 0; i < rawOrders.length; i++) {
      const order = rawOrders[i];
      console.log(`\n📋 RAW ORDER ${i + 1}:`);
      console.log('='.repeat(50));
      
      console.log('🔍 All Properties:');
      console.log(JSON.stringify(order, null, 2));
      
      console.log('\n📊 Key Fields:');
      console.log(`   orderHash: ${order.orderHash}`);
      console.log(`   orderInvalidReason: ${order.orderInvalidReason}`);
      console.log(`   fillableBalance: ${order.fillableBalance}`);
      console.log(`   remainingMakerAmount: ${order.remainingMakerAmount}`);
      console.log(`   makerBalance: ${order.makerBalance}`);
      console.log(`   makerAllowance: ${order.makerAllowance}`);
      console.log(`   createDateTime: ${order.createDateTime}`);
      
      // Check if it has the data field
      if (order.data) {
        console.log('\n💰 Order Data:');
        console.log(`   maker: ${order.data.maker}`);
        console.log(`   makerAsset: ${order.data.makerAsset}`);
        console.log(`   takerAsset: ${order.data.takerAsset}`);
        console.log(`   makingAmount: ${order.data.makingAmount}`);
        console.log(`   takingAmount: ${order.data.takingAmount}`);
        console.log(`   salt: ${order.data.salt}`);
        
        // Check actual token balances for this order
        console.log('\n🔍 Token Analysis:');
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
          const allowance = await tokenContract.allowance(walletAddress, '0x111111125421cA6dc452d289314280a0f8842A65');
          
          console.log(`   Token: ${symbol}`);
          console.log(`   Your balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
          console.log(`   Required: ${ethers.utils.formatUnits(order.data.makingAmount, decimals)} ${symbol}`);
          console.log(`   Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
          
          const hasBalance = balance.gte(ethers.BigNumber.from(order.data.makingAmount));
          const hasAllowance = allowance.gte(ethers.BigNumber.from(order.data.makingAmount));
          
          console.log(`   ✅ Sufficient balance: ${hasBalance}`);
          console.log(`   ✅ Sufficient allowance: ${hasAllowance}`);
          
          if (!hasBalance) {
            console.log(`   ⚠️  You need ${ethers.utils.formatUnits(ethers.BigNumber.from(order.data.makingAmount).sub(balance), decimals)} more ${symbol}`);
          }
          
          if (!hasAllowance) {
            console.log(`   ⚠️  You need to approve 1inch to spend ${ethers.utils.formatUnits(order.data.makingAmount, decimals)} ${symbol}`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking token: ${error.message}`);
        }
      }
      
      // Test the DCA filtering logic
      console.log('\n🎯 DCA Filter Test:');
      const wouldBeActive = !order.orderInvalidReason && (order.fillableBalance || '0') !== '0';
      console.log(`   orderInvalidReason: ${order.orderInvalidReason || 'null/undefined'}`);
      console.log(`   fillableBalance: ${order.fillableBalance || 'null/undefined'}`);
      console.log(`   fillableBalance || '0': ${order.fillableBalance || '0'}`);
      console.log(`   (fillableBalance || '0') !== '0': ${(order.fillableBalance || '0') !== '0'}`);
      console.log(`   Would be active: ${wouldBeActive}`);
      
      console.log(`\n${'='.repeat(50)}`);
    }
    
    console.log('\n🎯 Summary:');
    console.log(`• Found ${rawOrders.length} total orders`);
    
    const withFillableBalance = rawOrders.filter(o => o.fillableBalance && o.fillableBalance !== '0');
    const withoutInvalidReason = rawOrders.filter(o => !o.orderInvalidReason);
    
    console.log(`• Orders without invalid reason: ${withoutInvalidReason.length}`);
    console.log(`• Orders with fillableBalance > 0: ${withFillableBalance.length}`);
    
    console.log('\n💡 Next Steps:');
    console.log('• Check the token analysis above');
    console.log('• If balance/allowance issues, fix those first');
    console.log('• Visit https://app.1inch.io/ to see what the UI shows');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

rawOrderAnalysis();
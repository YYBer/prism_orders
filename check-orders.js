#!/usr/bin/env node

const { ethers } = require('ethers');
require('dotenv').config();

async function checkOrders() {
  try {
    console.log('🔍 Checking Orders on 1inch API');
    console.log('==============================\n');
    
    const chainId = process.env.CHAIN_ID || '8453';
    const apiKey = process.env.ONEINCH_API_KEY;
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!apiKey) {
      console.error('❌ ONEINCH_API_KEY not found in .env file');
      return;
    }
    
    if (!privateKey) {
      console.error('❌ PRIVATE_KEY not found in .env file');
      return;
    }
    
    // Get wallet address
    const wallet = new ethers.Wallet(privateKey);
    const walletAddress = wallet.address;
    
    console.log(`👤 Wallet: ${walletAddress}`);
    console.log(`🌐 Chain ID: ${chainId}`);
    console.log(`🔑 API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}\n`);
    
    // Direct API call to 1inch
    const url = `https://api.1inch.dev/orderbook/v4.0/${chainId}/orders?maker=${walletAddress}&limit=50`;
    
    console.log(`📡 Calling: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'accept': 'application/json'
      }
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${errorText}`);
      
      if (response.status === 401) {
        console.log('\n💡 Troubleshooting:');
        console.log('• Check your API key at https://portal.1inch.dev/');
        console.log('• Ensure the API key is valid and active');
      } else if (response.status === 429) {
        console.log('\n💡 Rate limited - try again in a few minutes');
      }
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📄 Raw API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (Array.isArray(data)) {
      console.log(`\n📈 Total Orders Found: ${data.length}`);
      
      if (data.length === 0) {
        console.log('\n📋 No orders found for this wallet.');
        console.log('\n💡 This could mean:');
        console.log('• No orders have been created with this wallet');
        console.log('• All orders have been filled or cancelled');
        console.log('• Orders were created on a different network');
        console.log('• Check manually at https://app.1inch.io/');
      } else {
        console.log('\n📋 Order Details:');
        console.log('================');
        
        data.forEach((order, index) => {
          console.log(`\n${index + 1}. Order Hash: ${order.orderHash}`);
          
          // Determine actual status
          let status;
          if (order.orderInvalidReason) {
            status = '❌ Invalid/Cancelled';
          } else if (order.fillableBalance === '0' || order.fillableBalance === 0) {
            status = '✅ Filled (Executed Successfully)';
          } else {
            status = '🟡 Active';
          }
          
          console.log(`   Status: ${status}`);
          console.log(`   Fillable Balance: ${order.fillableBalance || 'Unknown'}`);
          console.log(`   Created: ${order.createDateTime ? new Date(order.createDateTime).toLocaleString() : 'Unknown'}`);
          console.log(`   Invalid Reason: ${order.orderInvalidReason || 'None'}`);
          
          if (order.data) {
            console.log(`   Maker Asset: ${order.data.makerAsset}`);
            console.log(`   Taker Asset: ${order.data.takerAsset}`);
            console.log(`   Making Amount: ${order.data.makingAmount}`);
            console.log(`   Taking Amount: ${order.data.takingAmount}`);
          }
        });
        
        // Categorize orders
        const activeOrders = data.filter(order => 
          !order.orderInvalidReason && 
          order.fillableBalance && 
          order.fillableBalance !== '0'
        );
        
        const filledOrders = data.filter(order => 
          !order.orderInvalidReason && 
          (order.fillableBalance === '0' || order.fillableBalance === 0)
        );
        
        const cancelledOrders = data.filter(order => order.orderInvalidReason);
        
        console.log(`\n🟡 Active Orders: ${activeOrders.length}`);
        console.log(`✅ Filled Orders: ${filledOrders.length}`);
        console.log(`❌ Cancelled Orders: ${cancelledOrders.length}`);
        
        if (filledOrders.length > 0) {
          console.log('\n🎉 Congratulations! Your orders were executed successfully!');
          console.log('💰 Check your wallet - you should see the tokens you traded for.');
          console.log('\n✅ Filled Order Hashes:');
          filledOrders.forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.orderHash}`);
          });
        }
        
        if (activeOrders.length > 0) {
          console.log('\n🎯 Active Order Hashes:');
          activeOrders.forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.orderHash}`);
          });
          
          console.log('\n💡 To cancel these orders:');
          console.log('• Visit https://app.1inch.io/');
          console.log('• Connect your wallet');
          console.log('• Go to "Limit Orders" section');
          console.log('• Cancel orders individually (gas fee applies)');
        }
        
        if (activeOrders.length === 0 && filledOrders.length > 0) {
          console.log('\n💡 No orders to cancel - all your orders executed successfully!');
          console.log('• Visit https://app.1inch.io/ to see order history');
          console.log('• Check your wallet balance for received tokens');
          console.log('• View transaction history on Base explorer');
        }
      }
    } else {
      console.log('\n⚠️  Unexpected response format');
    }
    
  } catch (error) {
    console.error('\n❌ Error checking orders:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('• Check your internet connection');
    console.log('• Verify your .env file has correct values');
    console.log('• Try again in a few minutes');
  }
}

checkOrders();
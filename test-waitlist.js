// Simple test script for waitlist API
const fetch = require('node-fetch');

async function testWaitlist() {
  const testEmail = `test-${Date.now()}@example.com`;
  
  console.log('Testing waitlist API with email:', testEmail);
  
  try {
    // Test POST request
    const response = await fetch('http://localhost:3000/api/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✓ Waitlist submission successful');
      
      // Test GET request to check status
      const checkResponse = await fetch(`http://localhost:3000/api/waitlist?email=${encodeURIComponent(testEmail)}`);
      const checkData = await checkResponse.json();
      console.log('\nCheck response:', JSON.stringify(checkData, null, 2));
    } else {
      console.log('✗ Waitlist submission failed');
    }
  } catch (error) {
    console.error('Error testing waitlist:', error.message);
  }
}

// Check if server is running
testWaitlist();

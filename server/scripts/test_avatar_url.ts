
import { type Elysia } from 'elysia';

// Define the avatar path to test (taken from user's previous report)
const TEST_FILENAME = '2b550489-4b9e-48b5-a068-2f7e3ce1a431_1767172778621.jpg';
const URL = `http://localhost:3000/api/uploads/avatars/${TEST_FILENAME}`;

console.log(`Testing Avatar URL: ${URL}`);

try {
    const response = await fetch(URL);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Content-Length: ${response.headers.get('content-length')}`);

    if (response.ok) {
        console.log('SUCCESS: Image is servable.');
    } else {
        console.error('FAILURE: Image is NOT accessible.');
        const text = await response.text();
        console.error('Response body:', text);
    }
} catch (error) {
    console.error('Network Error during fetch:', error);
}

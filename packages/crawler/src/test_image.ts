async function testImage() {
  const url = 'https://image.invaluable.com/worldauctiongallery/62/812462/H20952-L436507552.jpg';
  try {
    console.log('Fetching image with browser headers...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
        'Referer': 'https://www.invaluable.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log('✅ Success! Image fetched successfully!');
    } else {
      console.log('❌ Failed.');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testImage();

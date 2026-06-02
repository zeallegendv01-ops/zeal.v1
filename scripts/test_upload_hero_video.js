const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Usage: node scripts/test_upload_hero_video.js <serverBaseUrl> <adminToken> <pathToVideo>
// Example: node scripts/test_upload_hero_video.js http://localhost:4000 "<TOKEN>" ./sample.mp4

async function main() {
  const [,, baseUrl, token, videoPath] = process.argv;
  if (!baseUrl || !token || !videoPath) {
    console.error('Usage: node test_upload_hero_video.js <serverBaseUrl> <adminToken> <pathToVideo>');
    process.exit(1);
  }

  if (!fs.existsSync(videoPath)) {
    console.error('Video file not found:', videoPath);
    process.exit(1);
  }

  const form = new FormData();
  form.append('video', fs.createReadStream(videoPath));

  try {
    console.log('Uploading video...');
    const uploadRes = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/hero-videos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000
    });

    console.log('Upload response:', uploadRes.data);
    const uploadedUrl = uploadRes.data?.data?.url;
    if (!uploadedUrl) {
      console.error('No uploaded URL in response');
      process.exit(2);
    }

    console.log('Fetching settings to confirm save...');
    const settingsRes = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/settings`);
    console.log('Settings heroVideos:', settingsRes.data.data?.heroVideos || []);

    console.log('Done');
  } catch (err) {
    if (err.response) {
      console.error('HTTP error:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
    process.exit(3);
  }
}

main();

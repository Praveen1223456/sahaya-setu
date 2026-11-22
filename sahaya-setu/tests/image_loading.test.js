const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

const app = require('../server/app');
const formatters = require('../server/views/formatters');
const env = require('../server/config/env');

describe('Image Loading & URL Construction Test Suite', () => {
  it('1. formatters.uploadUrl preserves valid Cloudinary URLs', () => {
    const cloudUrl = 'https://res.cloudinary.com/sahayasetu/image/upload/v1700000000/reports/pole.jpg';
    assert.equal(formatters.uploadUrl(cloudUrl), cloudUrl);

    const httpCloudUrl = 'http://res.cloudinary.com/sahayasetu/image/upload/v1700000000/resolutions/fixed.jpg';
    assert.equal(formatters.uploadUrl(httpCloudUrl), httpCloudUrl);
  });

  it('2. formatters.uploadUrl normalizes local paths correctly', () => {
    // Normal absolute path
    assert.equal(formatters.uploadUrl('/uploads/reports/pole_before.jpg'), '/uploads/reports/pole_before.jpg');

    // Double slash / repeated uploads bug
    assert.equal(formatters.uploadUrl('/uploads//uploads/reports/pole_before.jpg'), '/uploads/reports/pole_before.jpg');

    // Missing leading slash
    assert.equal(formatters.uploadUrl('reports/pole_before.jpg'), '/uploads/reports/pole_before.jpg');
    assert.equal(formatters.uploadUrl('resolutions/tree_after.jpg'), '/uploads/resolutions/tree_after.jpg');
  });

  it('3. formatters.uploadUrl prevents bare filenames from becoming invalid hostnames', () => {
    // The core bug reported: 14734.png and 14735.png
    assert.equal(formatters.uploadUrl('14734.png'), '/uploads/reports/14734.png');
    assert.equal(formatters.uploadUrl('14735.png'), '/uploads/reports/14735.png');

    // Protocol-relative double slashes: //14734.png
    assert.equal(formatters.uploadUrl('//14734.png'), '/uploads/reports/14734.png');
    assert.equal(formatters.uploadUrl('//14735.png'), '/uploads/reports/14735.png');

    // Resolution bare filename
    assert.equal(formatters.uploadUrl('tree_after.jpg'), '/uploads/resolutions/tree_after.jpg');
  });

  it('4. formatters.uploadUrl handles null, undefined, empty, and data URIs', () => {
    assert.equal(formatters.uploadUrl(null), null);
    assert.equal(formatters.uploadUrl(undefined), null);
    assert.equal(formatters.uploadUrl(''), null);
    assert.equal(formatters.uploadUrl('   '), null);

    const dataUri = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    assert.equal(formatters.uploadUrl(dataUri), dataUri);
  });

  it('5. Express static serves existing uploaded complaint images', async () => {
    // Verify an existing demo photo or create a dummy test photo in env.UPLOAD_DIR/reports
    const testDir = path.join(env.UPLOAD_DIR, 'reports');
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, 'test_sample.jpg');
    fs.writeFileSync(testFile, Buffer.from('fake-jpeg-data'));

    const res = await request(app).get('/uploads/reports/test_sample.jpg');
    assert.equal(res.status, 200);

    // Clean up
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('6. Express returns 404 with SVG fallback for missing uploads instead of HTML SPA', async () => {
    const res = await request(app)
      .get('/uploads/reports/definitely_nonexistent_image_99999.jpg')
      .set('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');

    assert.equal(res.status, 404);
    assert.ok(
      res.headers['content-type'].includes('image/svg+xml') ||
      res.headers['content-type'].includes('application/json')
    );
    // Crucially: it must NOT return HTML SPA
    assert.ok(!res.headers['content-type'].includes('text/html'));
  });

  it('7. Frontend getImageUrl utility behaves identically and safely', async () => {
    const { getImageUrl, FALLBACK_IMAGE } = await import('../client/src/utils/imageUrl.js');

    // Cloudinary preservation
    const cloudUrl = 'https://res.cloudinary.com/test/image.jpg';
    assert.equal(getImageUrl(cloudUrl), cloudUrl);

    // Local normalization
    assert.equal(getImageUrl('/uploads/reports/pole.jpg'), '/uploads/reports/pole.jpg');
    assert.equal(getImageUrl('/uploads//uploads/reports/pole.jpg'), '/uploads/reports/pole.jpg');
    assert.equal(getImageUrl('reports/pole.jpg'), '/uploads/reports/pole.jpg');

    // Invalid hostnames prevention
    assert.equal(getImageUrl('14734.png'), '/uploads/reports/14734.png');
    assert.equal(getImageUrl('//14734.png'), '/uploads/reports/14734.png');

    // Fallbacks
    assert.equal(getImageUrl(null), FALLBACK_IMAGE);
    assert.equal(getImageUrl(''), FALLBACK_IMAGE);
    assert.equal(getImageUrl(undefined), FALLBACK_IMAGE);
  });
});

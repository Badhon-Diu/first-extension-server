'use strict';

require('dotenv').config();
const fs = require('fs');

const IS_VERCEL    = process.env.VERCEL === '1';
const AUDIO_DIR    = IS_VERCEL ? '/tmp/uploads'          : 'uploads';
const SESSIONS_DIR = IS_VERCEL ? '/tmp/uploads/sessions' : 'uploads/sessions';

if (!fs.existsSync(AUDIO_DIR))    fs.mkdirSync(AUDIO_DIR,    { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const CONFIG = {
  port: process.env.PORT || 3001,

  audioApiUrl: process.env.AUDIO_API_URL || (() => { throw new Error('AUDIO_API_URL not set in .env'); })(),

  imageApiUrl: process.env.IMAGE_API_URL || 'https://image-api-u5dy.onrender.com/api/analyze-images',

  imageBatchSize: 3,
};

module.exports = { CONFIG, IS_VERCEL, AUDIO_DIR, SESSIONS_DIR };

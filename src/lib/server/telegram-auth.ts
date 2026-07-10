import crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface ParsedInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  [key: string]: any;
}

/**
 * Parses and cryptographically verifies Telegram Mini App initData.
 * @param initDataRaw The raw query string sent from the Telegram frontend.
 * @returns The parsed user data if valid, or throws an error.
 */
export function verifyTelegramAuth(initDataRaw: string): TelegramUser {
  if (!initDataRaw) {
    throw new Error('Missing Telegram initData');
  }

  // Development bypass: if in development mode and token is missing/placeholder, return a dev user
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const isDev = process.env.NODE_ENV === 'development';
  const isPlaceholderToken = !botToken || botToken === 'your_telegram_bot_token';

  if (isDev && isPlaceholderToken) {
    console.warn('⚠️ [TELEGRAM-AUTH] Running in development mode with placeholder bot token. Bypassing auth verification.');
    
    // Parse the data if possible, otherwise return a mock developer user
    try {
      const params = new URLSearchParams(initDataRaw);
      const userStr = params.get('user');
      if (userStr) {
        return JSON.parse(userStr) as TelegramUser;
      }
    } catch (e) {
      // Fallback if parsing fails
    }
    
    return {
      id: 99999999,
      first_name: 'Developer',
      last_name: 'Local',
      username: 'dev_user',
    };
  }

  if (!botToken || botToken === 'your_telegram_bot_token') {
    throw new Error('Server configuration error: TELEGRAM_BOT_TOKEN is not set');
  }

  // 1. Parse query string
  const params = new URLSearchParams(initDataRaw);
  const parsedData: Record<string, string> = {};
  let hash = '';

  for (const [key, value] of params.entries()) {
    if (key === 'hash') {
      hash = value;
    } else {
      parsedData[key] = value;
    }
  }

  if (!hash) {
    throw new Error('Hash missing from initData');
  }

  // 2. Sort keys alphabetically
  const sortedKeys = Object.keys(parsedData).sort();

  // 3. Construct data-check-string (key=value joined by \n)
  const dataCheckString = sortedKeys
    .map((key) => `${key}=${parsedData[key]}`)
    .join('\n');

  // 4. Calculate secret key: HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // 5. Calculate validation hash: HMAC-SHA256(secretKey, dataCheckString)
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // 6. Compare hashes
  if (computedHash !== hash) {
    throw new Error('Invalid signature. Authentication failed.');
  }

  // 7. Validate expiration (optional, e.g., 24 hours)
  const authDate = parseInt(parsedData['auth_date'] || '0', 10);
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDifference = currentTime - authDate;
  
  // 24 hours = 86400 seconds
  if (timeDifference > 86400) {
    throw new Error('Authentication data has expired.');
  }

  // 8. Extract and parse user data
  if (!parsedData['user']) {
    throw new Error('User data missing from initData');
  }

  try {
    return JSON.parse(parsedData['user']) as TelegramUser;
  } catch (e) {
    throw new Error('Malformed user field in initData');
  }
}

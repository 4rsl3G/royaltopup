import { Setting } from '../models/index.js';
import { encryptText, decryptText } from '../config/crypto.js';

export async function getSetting(key, def=null){
  const s = await Setting.findByPk(key);
  return s?.value ?? def;
}

export async function setSetting(key, value){
  await Setting.upsert({ key, value: String(value ?? ''), updated_at: new Date() });
}

export async function setSecret(key, plain){
  await setSetting(key, encryptText(String(plain)));
}

export async function getSecret(key){
  const v = await getSetting(key);
  if (!v) return null;
  try { return decryptText(v); } catch { return null; }
}

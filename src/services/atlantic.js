import axios from 'axios';
import { getSecret, getSetting } from './settings.js';

async function base(){
  const apiurl = await getSetting('api_url', 'https://atlantich2h.com');
  const api_key = await getSecret('api_key_enc');
  if (!api_key) throw new Error('API key not set');
  return { apiurl: apiurl.replace(/\/+$/,''), api_key };
}

export async function getProfile(){
  const { apiurl, api_key } = await base();
  const { data } = await axios.post(`${apiurl}/get_profile`, new URLSearchParams({ api_key }), {
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  return data;
}

export async function depositCreate({ reff_id, nominal, type='ewallet', metode='qris' }){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, reff_id, nominal:String(nominal), type, metode });
  const { data } = await axios.post(`${apiurl}/deposit/create`, body, { timeout:20000 });
  return data;
}

export async function depositStatus({ id }){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, id:String(id) });
  const { data } = await axios.post(`${apiurl}/deposit/status`, body, { timeout:20000 });
  return data;
}

export async function depositCancel({ id }){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, id:String(id) });
  const { data } = await axios.post(`${apiurl}/deposit/cancel`, body, { timeout:20000 });
  return data;
}

export async function bankList(){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key });
  const { data } = await axios.post(`${apiurl}/transfer/bank_list`, body, { timeout:20000 });
  return data;
}

export async function cekRekening({ bank_code, account_number }){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, bank_code, account_number });
  const { data } = await axios.post(`${apiurl}/transfer/cek_rekening`, body, { timeout:20000 });
  return data;
}

export async function transferCreate(payload){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, ...payload });
  const { data } = await axios.post(`${apiurl}/transfer/create`, body, { timeout:30000 });
  return data;
}

export async function transferStatus({ id }){
  const { apiurl, api_key } = await base();
  const body = new URLSearchParams({ api_key, id:String(id) });
  const { data } = await axios.post(`${apiurl}/transfer/status`, body, { timeout:20000 });
  return data;
}

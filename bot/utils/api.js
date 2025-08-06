import fetch from 'node-fetch';

export async function fetchEthPrice() {
  const url = `${process.env.COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd`;
  const headers = { 'Accept': 'application/json', 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    const price = data['ethereum']?.usd;
    if (price == null) throw new Error('Unexpected API response structure');
    return price;
  } catch (error) { console.error(error.message); return 0; }
}

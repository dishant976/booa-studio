// Same logic as Khora's src/app/api/banner-nfts/route.ts
const BOOA_CONTRACT = '0x7aecA981734d133d3f695937508C48483BA6b654';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address, chain = 'shape' } = req.query;
  const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))
    return res.status(400).json({ error: 'Invalid address' });

  if (!ALCHEMY_KEY)
    return res.status(500).json({ error: 'ALCHEMY_API_KEY not set' });

  const network = chain === 'shape' ? 'shape-mainnet' : 'shape-sepolia';

  try {
    const allNfts = [];
    let pageKey;
    for (let page = 0; page < 10; page++) {
      const url = new URL(`https://${network}.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`);
      url.searchParams.set('owner', address);
      url.searchParams.set('withMetadata', 'true');
      url.searchParams.set('pageSize', '100');
      url.searchParams.append('contractAddresses[]', BOOA_CONTRACT);
      if (pageKey) url.searchParams.set('pageKey', pageKey);

      const r = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ error: 'Alchemy error ' + r.status });

      const data = await r.json();
      allNfts.push(...(data.ownedNfts || []));
      pageKey = data.pageKey;
      if (!pageKey) break;
    }

    const nfts = allNfts.map(nft => {
      const meta = nft.raw?.metadata || {};
      const img = nft.image || {};
      const metaImage = meta.image || '';
      let svg = '';
      if (metaImage.startsWith('data:image/svg+xml;base64,')) {
        try {
          svg = Buffer.from(
            metaImage.replace('data:image/svg+xml;base64,', ''), 'base64'
          ).toString('utf8');
        } catch {}
      }
      return {
        tokenId: nft.tokenId || '0',
        name: nft.name || meta.name || `BOOA #${nft.tokenId}`,
        svg,
        imageUrl: img.cachedUrl || img.thumbnailUrl || metaImage || '',
      };
    });

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ nfts, totalCount: nfts.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

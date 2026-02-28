export type ReservedCategory =
  | 'blocked'
  | 'stopWords'
  | 'prominentNames'
  | 'brands'
  | 'techTerms'
  | 'cryptoTerms'
  | 'commonFirstNames'
  | 'highValueShort'
  | 'singleCharacter'
  | 'twoCharacter';

export interface ReservedNameMeta {
  category: ReservedCategory;
  auctionOnly: boolean;
  marketplacePriceSats?: number;
  multiplier?: number;
  reason: string;
}

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

const SINGLE_CHARACTER = ALPHANUM.split('');

const TWO_CHARACTER = ALPHANUM.split('').flatMap((a) =>
  ALPHANUM.split('').map((b) => `${a}${b}`),
);

const STOP_WORDS = [
  'a','about','above','across','after','afterwards','again','against','all','almost','alone','along','already','also','although','always','am','among','amongst','an','and','another','any','anyhow','anyone','anything','anyway','anywhere','are','around','as','at','be','became','because','become','becomes','becoming','been','before','beforehand','behind','being','below','beside','besides','between','beyond','both','but','by','can','cannot','could','did','do','does','doing','done','down','due','during','each','either','else','elsewhere','enough','etc','even','ever','every','everyone','everything','everywhere','except','few','for','former','formerly','from','further','had','has','have','having','he','hence','her','here','hereafter','hereby','herein','hereupon','hers','herself','him','himself','his','how','however','i','if','in','indeed','into','is','it','its','itself','just','keep','last','latter','latterly','least','less','made','many','may','me','meanwhile','might','mine','more','moreover','most','mostly','much','must','my','myself','namely','near','neither','never','nevertheless','next','no','nobody','none','noone','nor','not','nothing','now','nowhere','of','off','often','on','once','one','only','onto','or','other','others','otherwise','our','ours','ourselves','out','over','own','per','perhaps','please','put','rather','re','same','see','seem','seemed','seeming','seems','serious','several','she','should','since','so','some','somehow','someone','something','sometime','sometimes','somewhere','still','such','take','than','that','the','their','theirs','them','themselves','then','thence','there','thereafter','thereby','therefore','therein','thereupon','these','they','this','those','through','throughout','thru','thus','to','together','too','toward','towards','under','unless','until','up','upon','us','very','via','was','we','well','were','what','whatever','when','whence','whenever','where','whereafter','whereas','whereby','wherein','whereupon','wherever','whether','which','while','whither','who','whoever','whole','whom','whose','why','will','with','within','without','would','yet','you','your','yours','yourself','yourselves'
];

const PROMINENT_NAMES = [
  'jack','satoshi','nakamoto','elon','musk','trump','biden','obama','putin','modi','taylorswift','swift','drake','rihanna','beyonce','kanye','kimkardashian','zuck','markzuckerberg','bezos','jeffbezos','billgates','stevejobs','timcook','sundarpichai','satyanadella','larrypage','sergeybrin','samaltman','gates','naval','vitalik','vbuterin','cz','changpengzhao','brianarmstrong','michaelaylor','saylor','andreas','antonopoulos','snowden','assange','lexfridman','joerogan','mrbeast','pewdiepie','loganpaul','ksi','ronaldo','messi','neymar','federer','nadal','lebron','jordan','kobe','serena','oprah','ellen','chapelle','keanu','dicaprio','scarlett','tomcruise','willsmith','dwayne','therock','hanks','bradpitt','angelina','adele','eminem','snoop','icecube','2pac','biggie','jayz','cardib','nickiminaj','ladygaga','edsheeran','billieeilish','ariana','selena','justinbieber','postmalone','theweeknd','badbunny','shakira','anitta','cristiano','viratkohli','dhoni','sachin','narendramodi','xi','kimjongun','zelensky','macron','merkel','pope','dalailama','teslaelon','donaldtrump','joebiden','kamala','hillary','bernie','aoc','pelosi','schumer','desantis','vivek','rfkjr','benjamin','netanyahu'
];

const BRANDS = [
  'google','alphabet','youtube','gmail','android','chrome','pixel','maps','facebook','meta','instagram','whatsapp','threads','x','twitter','xcom','tesla','spacex','starlink','apple','iphone','ipad','macbook','airpods','microsoft','windows','xbox','github','openai','chatgpt','anthropic','claude','amazon','aws','prime','netflix','disney','pixar','hulu','espn','tiktok','bytedance','snapchat','snap','reddit','linkedin','paypal','venmo','stripe','shopify','coinbase','binance','kraken','gemini','okx','bybit','huobi','kucoin','robinhood','cashapp','block','square','visa','mastercard','amex','nike','adidas','puma','reebok','gucci','prada','louisvuitton','lv','chanel','dior','rolex','uber','lyft','airbnb','booking','expedia','doordash','ubereats','grubhub','instacart','walmart','target','costco','ikea','samsung','sony','nintendo','playstation','steam','valve','epic','fortnite','riot','blizzard','ea','activision','oracle','ibm','intel','amd','nvidia','arm','qualcomm','cloudflare','digitalocean','vercel','netlify','heroku','twilio','sendgrid','dropbox','notion','figma','canva','slack','zoom','telegram','signal','discord','proton','firefox','mozilla','wordpress','automattic'
];

const TECH_TERMS = [
  'api','sdk','cli','dev','developer','admin','root','system','support','help','ops','devops','backend','frontend','database','db','sql','nosql','redis','postgres','mysql','mongodb','kafka','graphql','rest','grpc','http','https','tcp','udp','ssh','dns','cdn','cache','proxy','gateway','server','client','kernel','linux','ubuntu','debian','fedora','arch','alpine','docker','kubernetes','k8s','helm','terraform','ansible','jenkins','git','gitlab','bitbucket','repo','branch','commit','merge','release','prod','staging','test','testing','qa','sre','incident','pager','monitor','metrics','logs','alert','uptime','security','auth','login','signup','signin','oauth','jwt','token','session','cookie','password','email','smtp','imap','pop3','ssl','tls','vpn','firewall','malware','phishing','bot','ai','ml','llm','gpt','model','prompt','agent','oracle','openclaw','nostrmaxi','relay','nostr','nip05','nip','wallet','invoice','lightning'
];

const CRYPTO_TERMS = [
  'bitcoin','btc','xbt','satoshi','sat','sats','lightning','ln','lnurl','lnbits','lnbc','payjoin','coinjoin','coldcard','trezor','ledger','electrum','wasabi','sparrow','phoenix','breez','zeus','mutiny','nostr','npub','nsec','nprofile','nevent','naddr','nip','zap','zaps','ecash','cashu','fedimint','fedi','minibits','nutzap','blossom','relay','relaylist','wot','weboftrust','hashrate','mining','miner','halving','block','blockchain','mempool','utxo','rune','runes','ordinals','inscriptions','taproot','segwit','bech32','bech32m','script','multisig','threshold','frost','musig','eth','ethereum','sol','solana','ada','cardano','dot','polkadot','avax','avalanche','matic','polygon','bnb','doge','xrp','atom','cosmos','near','apt','sui','trx','tron','link','chainlink','uni','uniswap','aave','maker','dai','usdt','usdc','stablecoin','defi','dex','cex','amm','lp','staking','validator','slashing','yield','farm','airdrops','airdrop','seedphrase','mnemonic','privatekey','publickey','pubkey','address','wallet','custody','selfcustody','proof','pow','pos','nft','dao','token','ico','ido','ieo','whitepaper','hodl','rekt','wagmi','gm','ngmi','degen','pleb','orange','bitcoiner','cypherpunk','sovereignty','freedommoney'
];

const COMMON_FIRST_NAMES = [
  'james','john','robert','michael','william','david','richard','joseph','thomas','charles','christopher','daniel','matthew','anthony','mark','donald','steven','paul','andrew','joshua','kenneth','kevin','brian','george','timothy','ronald','edward','jason','jeffrey','ryan','jacob','gary','nicholas','eric','jonathan','stephen','larry','justin','scott','brandon','benjamin','samuel','frank','gregory','raymond','alexander','patrick','jack','dennis','jerry','tyler','aaron','jose','adam','henry','douglas','nathan','peter','zachary','kyle','walter','harold','jeremy','ethan','carl','keith','roger','gerald','christian','terry','sean','arthur','austin','noah','jesse','joe','bryan','billy','jordan','albert','dylan','bruce','willie','gabriel','alan','juan','logan','wayne','ralph','roy','eugene','randy','vincent','russell','louis','philip','bobby','johnny','bradley','mary','patricia','jennifer','linda','elizabeth','barbara','susan','jessica','sarah','karen','nancy','lisa','betty','margaret','sandra','ashley','kimberly','emily','donna','michelle','carol','amanda','melissa','deborah','stephanie','rebecca','laura','sharon','cynthia','kathleen','amy','shirley','angela','helen','anna','brenda','pamela','nicole','emma','samantha','katherine','christine','debra','rachel','catherine','carolyn','janet','ruth','maria','heather','diane','virginia','julie','joyce','victoria','olivia','kelly','christina','lauren','joan','evelyn','judith','megan','andrea','hannah','jacqueline','martha','gloria','teresa','sara','janice','marie','madison','frances','kathryn','julia','grace','judy','abigail','jean','denise','amber','doris','marilyn','danielle','beverly','isabella','theresa','diana','natalie','sophia','rose','alexis','kayla','charlotte'
];

const HIGH_VALUE_SHORT = [
  'ai','ml','vr','ar','ui','ux','gm','gn','btc','eth','sol','xrp','ada','dot','avax','link','uni','defi','nft','dao','dex','cex','api','app','web','www','com','org','io','dev','sys','ops','db','sql','aws','gcp','cdn','vpn','ssh','dns','tls','ssl','git','bot','zap','sat','ln','npub','nsec','nostr','news','chat','mail','shop','bank','fund','earn','loan','pay','coin','cash','gold','moon','pump','alpha','beta','meta','open','core','labs','node','mint','swap','pool','farm','yield','hedge','volt','nova','zero','hero','king','queen','boss','pro','max','prime','plus','ultra','nano','micro','macro','byte','hash','block','chain','relay','worm','blue','red','black','white','green','orange'
];

const BLOCKED = [
  'admin','administrator','root','owner','mod','moderator','staff','team','support','help','security','abuse','postmaster','hostmaster','webmaster','noreply','no-reply','mailer-daemon','api','status','health','metrics','login','logout','signup','register','system','daemon','service','null','undefined','test','guest','anonymous','default','billing','payments','finance','legal','privacy','terms','compliance','trust','verified','official','nostrmaxi','nostrmaxiadmin'
];

export const RESERVED_NAMES = {
  blocked: BLOCKED,
  stopWords: STOP_WORDS,
  prominentNames: PROMINENT_NAMES,
  brands: BRANDS,
  techTerms: TECH_TERMS,
  cryptoTerms: CRYPTO_TERMS,
  commonFirstNames: COMMON_FIRST_NAMES,
  highValueShort: HIGH_VALUE_SHORT,
  singleCharacter: SINGLE_CHARACTER,
  twoCharacter: TWO_CHARACTER,
} as const;

export const PRICING_MULTIPLIERS = {
  base: 1,
  short4: 10,
  short3: 100,
  short2: 1000,
  short1: 10000,
  stopWords: 20,
  commonFirstNames: 50,
  prominentNames: 250,
  brands: 500,
  techTerms: 30,
  cryptoTerms: 40,
  highValueShort: 120,
} as const;

const CATEGORY_REASON: Record<ReservedCategory, string> = {
  blocked: 'blocked for operational/security reasons',
  stopWords: 'common search stop word with high namespace value',
  prominentNames: 'high impersonation risk due to public figure association',
  brands: 'brand/trademark related namespace',
  techTerms: 'generic high-intent technology term',
  cryptoTerms: 'high-demand crypto/bitcoin ecosystem term',
  commonFirstNames: 'popular first-name identity namespace',
  highValueShort: 'high-liquidity short namespace',
  singleCharacter: 'single-character namespace is ultra scarce',
  twoCharacter: 'two-character namespace is very scarce',
};

const CATEGORY_AUCTION_ONLY = new Set<ReservedCategory>([
  'singleCharacter',
  'twoCharacter',
  'prominentNames',
  'brands',
  'highValueShort',
]);

const CATEGORY_FIXED_PRICE: Partial<Record<ReservedCategory, number>> = {
  stopWords: 420000,
  commonFirstNames: 1050000,
  techTerms: 840000,
  cryptoTerms: 1250000,
};

const RESERVED_META = new Map<string, ReservedNameMeta>();

function registerCategory(category: ReservedCategory, values: readonly string[]) {
  for (const raw of values) {
    const name = raw.toLowerCase();
    if (!name) continue;
    if (RESERVED_META.has(name) && category !== 'blocked') continue;

    RESERVED_META.set(name, {
      category,
      auctionOnly: CATEGORY_AUCTION_ONLY.has(category),
      marketplacePriceSats: CATEGORY_FIXED_PRICE[category],
      multiplier:
        category === 'stopWords'
          ? PRICING_MULTIPLIERS.stopWords
          : category === 'commonFirstNames'
            ? PRICING_MULTIPLIERS.commonFirstNames
            : category === 'prominentNames'
              ? PRICING_MULTIPLIERS.prominentNames
              : category === 'brands'
                ? PRICING_MULTIPLIERS.brands
                : category === 'techTerms'
                  ? PRICING_MULTIPLIERS.techTerms
                  : category === 'cryptoTerms'
                    ? PRICING_MULTIPLIERS.cryptoTerms
                    : category === 'highValueShort'
                      ? PRICING_MULTIPLIERS.highValueShort
                      : undefined,
      reason: CATEGORY_REASON[category],
    });
  }
}

registerCategory('blocked', RESERVED_NAMES.blocked);
registerCategory('stopWords', RESERVED_NAMES.stopWords);
registerCategory('prominentNames', RESERVED_NAMES.prominentNames);
registerCategory('brands', RESERVED_NAMES.brands);
registerCategory('techTerms', RESERVED_NAMES.techTerms);
registerCategory('cryptoTerms', RESERVED_NAMES.cryptoTerms);
registerCategory('commonFirstNames', RESERVED_NAMES.commonFirstNames);
registerCategory('highValueShort', RESERVED_NAMES.highValueShort);
registerCategory('singleCharacter', RESERVED_NAMES.singleCharacter);
registerCategory('twoCharacter', RESERVED_NAMES.twoCharacter);

export function getReservedNameMeta(name: string): ReservedNameMeta | undefined {
  return RESERVED_META.get(name.toLowerCase());
}

export function isReservedName(name: string): boolean {
  return RESERVED_META.has(name.toLowerCase());
}

export function isBlockedName(name: string): boolean {
  return getReservedNameMeta(name)?.category === 'blocked';
}

export function getReservedNamesCount(): number {
  return RESERVED_META.size;
}

export function getReservedNamesByCategory(category: ReservedCategory): string[] {
  return [...new Set(RESERVED_NAMES[category])];
}

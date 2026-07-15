const fs = require("fs");
const path = require("path");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/generate-labs-from-official.js /path/to/labs.json");
  process.exit(1);
}

const official = JSON.parse(fs.readFileSync(sourcePath, "utf8")).labs;
if (!Array.isArray(official)) {
  console.error("Expected official JSON to contain a labs array.");
  process.exit(1);
}

const TAGS = [
  "AI・機械学習",
  "データ分析",
  "ソフトウェア・情報システム",
  "セキュリティ・ネットワーク",
  "VR・AR・ヒューマンインタフェース",
  "ロボット・制御",
  "電子回路・通信",
  "数学・数理モデル",
  "物理・材料",
  "化学・生命",
  "環境・エネルギー",
  "人間・社会・教育"
];

const TAG_RULES = [
  ["AI・機械学習", /AI|人工知能|機械学習|深層学習|知能|ニューラル|認識|生成|自然言語|音声|画像|コンピュータビジョン/],
  ["データ分析", /データ|統計|解析|分析|可視化|予測|最適化|ビッグデータ|データサイエンス|数理データ/],
  ["ソフトウェア・情報システム", /ソフトウェア|情報システム|システム|プログラム|アルゴリズム|計算機|コンピュータ|Web|アプリ|データベース|クラウド|情報処理|OS|並列|分散/],
  ["セキュリティ・ネットワーク", /セキュリティ|暗号|ネットワーク|通信|無線|インターネット|IoT|プライバシ|認証|サイバー/],
  ["VR・AR・ヒューマンインタフェース", /VR|AR|XR|仮想|拡張現実|インタフェース|インタラクション|メディア|感性|触覚|ユーザ|ユーザー|ヒューマン|人間拡張|可聴|音響/],
  ["ロボット・制御", /ロボット|制御|メカトロ|ドローン|自律|移動体|マニピュレータ|アクチュエータ|機械システム/],
  ["電子回路・通信", /電子|回路|半導体|デバイス|集積|LSI|信号処理|アンテナ|マイクロ波|電磁波|通信|センサ|センサー/],
  ["数学・数理モデル", /数学|数理|モデル|理論|証明|最適化|離散|確率|統計|シミュレーション|アルゴリズム|計算量|解析学|幾何/],
  ["物理・材料", /物理|量子|光|レーザ|レーザー|プラズマ|材料|ナノ|結晶|磁性|超伝導|熱|流体|力学|素粒子/],
  ["化学・生命", /化学|生命|生体|生物|細胞|分子|バイオ|医療|創薬|タンパク|遺伝子|有機|無機/],
  ["環境・エネルギー", /環境|エネルギ|電力|太陽|燃料|省エネ|サステナ|資源|気候|グリーン|蓄電/],
  ["人間・社会・教育", /人間|社会|教育|学習|心理|認知|経営|経済|言語|コミュニケーション|支援|福祉|文化|デザイン|評価|ユーザ|ユーザー/]
];

function stripNumber(value) {
  return String(value || "").replace(/^\d+\./, "").trim();
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/ 研究室$/, "　研究室").trim();
}

function getTeacherName(rawName) {
  return normalizeName(rawName).replace(/[\s　]*研究室$/, "").trim();
}

function getLabName(rawName) {
  const teacher = getTeacherName(rawName);
  if (!teacher) return "研究室";

  const names = teacher
    .split(/・|、|,|\/| and /)
    .map(value => value.trim())
    .filter(Boolean);

  const surnames = names.map(value => {
    if (/^[A-Za-z]/.test(value)) return value.split(/\s+/)[0];
    return value.split(/\s+/)[0];
  });

  return `${surnames.join("・")}研究室`;
}

function getSearchText(lab) {
  return [
    lab.name,
    lab.group,
    lab.program,
    lab.title,
    lab.description,
    (lab.keywords || []).join(" "),
    (lab.fields || []).join(" ")
  ].join(" ");
}

function getTags(lab) {
  const text = getSearchText(lab);
  const tags = TAG_RULES
    .filter(([, rule]) => rule.test(text))
    .map(([tag]) => tag);
  const program = stripNumber(lab.program);

  if (/メディア/.test(program)) tags.push("VR・AR・ヒューマンインタフェース", "人間・社会・教育");
  if (/経営|社会/.test(program)) tags.push("人間・社会・教育", "データ分析");
  if (/情報数理/.test(program)) tags.push("数学・数理モデル", "ソフトウェア・情報システム");
  if (/コンピュータサイエンス/.test(program)) tags.push("ソフトウェア・情報システム", "AI・機械学習");
  if (/データサイエンス/.test(program)) tags.push("データ分析", "AI・機械学習");
  if (/セキュリティ/.test(program)) tags.push("セキュリティ・ネットワーク", "ソフトウェア・情報システム");
  if (/情報通信/.test(program)) tags.push("セキュリティ・ネットワーク", "電子回路・通信");
  if (/電子情報|電子工学/.test(program)) tags.push("電子回路・通信");
  if (/計測|制御/.test(program)) tags.push("ロボット・制御", "電子回路・通信");
  if (/ロボティクス|機械/.test(program)) tags.push("ロボット・制御");
  if (/光|物理/.test(program)) tags.push("物理・材料");
  if (/化学|生命/.test(program)) tags.push("化学・生命");

  const unique = [...new Set(tags)].filter(tag => TAGS.includes(tag));
  return (unique.length ? unique : ["ソフトウェア・情報システム"]).slice(0, 4);
}

function clamp(value) {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  if (/^www\./.test(url)) return `https://${url}`;
  return url;
}

function getPosition(lab, tags) {
  const program = stripNumber(lab.program);
  const text = getSearchText(lab);
  let x = 0;
  let y = 0;

  if (/メディア/.test(program)) {
    x = -25;
    y = 25;
  } else if (/経営|社会/.test(program)) {
    x = -55;
    y = 5;
  } else if (/情報数理/.test(program)) {
    x = 35;
    y = -45;
  } else if (/コンピュータサイエンス/.test(program)) {
    x = 55;
    y = -5;
  } else if (/データサイエンス/.test(program)) {
    x = 25;
    y = 0;
  } else if (/セキュリティ/.test(program)) {
    x = 45;
    y = 15;
  } else if (/情報通信/.test(program)) {
    x = 55;
    y = 25;
  } else if (/電子情報|電子工学/.test(program)) {
    x = 60;
    y = 20;
  } else if (/計測|制御/.test(program)) {
    x = 35;
    y = 45;
  } else if (/ロボティクス|機械/.test(program)) {
    x = 25;
    y = 60;
  } else if (/光|物理/.test(program)) {
    x = 35;
    y = -30;
  } else if (/化学|生命/.test(program)) {
    x = 5;
    y = 5;
  }

  if (tags.includes("人間・社会・教育")) x -= 18;
  if (tags.includes("AI・機械学習") || tags.includes("ソフトウェア・情報システム")) x += 10;
  if (tags.includes("ロボット・制御") || tags.includes("電子回路・通信")) {
    x += 8;
    y += 12;
  }
  if (tags.includes("数学・数理モデル")) y -= 22;
  if (tags.includes("物理・材料")) y -= 8;
  if (tags.includes("化学・生命")) x -= 8;
  if (/実験|開発|実装|制作|構築|装置|デバイス|ロボット|計測|制御|フィールド/.test(text)) y += 18;
  if (/理論|数理|原理|基礎|解析|証明|モデル/.test(text)) y -= 18;

  const jitter = ((Number(lab.order) || 0) % 9 - 4) * 2;
  return { x: clamp(x + jitter), y: clamp(y - jitter) };
}

const labs = official
  .slice()
  .sort((a, b) => (a.order || 0) - (b.order || 0))
  .map((lab, index) => {
    const tags = getTags(lab);
    const position = getPosition(lab, tags);
    const urls = [
      ...(Array.isArray(lab.url) ? lab.url : []),
      ...(Array.isArray(lab.visiting_url) ? lab.visiting_url : [])
    ].map(normalizeUrl).filter(Boolean);
    const url = urls[0] || "https://www.uec.ac.jp/arc/laboguide.html";

    return {
      id: `uec-labguide-${String(index + 1).padStart(3, "0")}`,
      guidebookName: lab.guidebook_name,
      name: getLabName(lab.name),
      teacher: getTeacherName(lab.name),
      cluster: lab.group,
      program: stripNumber(lab.program),
      summary: lab.title || String(lab.description || "").slice(0, 80),
      tags,
      x: position.x,
      y: position.y,
      url,
      urlLabel: urls[0] ? "研究室サイトを見る" : "ラボガイドで確認",
      sourceUrl: "https://www.uec.ac.jp/arc/laboguide.html",
      imageUrl: lab.image_path || "",
      reviewStatus: "official-labguide",
      updatedAt: lab.updatedAt
    };
  });

const output = `/*
 * 電気通信大学公式「研究室検索（ラボガイド）」の公開JSONに掲載された研究室のみを収録しています。
 * 座標とタグはラボガイド掲載情報のプログラム・分野・紹介文キーワードから暫定推定しています。
 * 公式データ取得元: https://www.uec.ac.jp/arc/assets/labs.json
 * 取得日: 2026-07-15
 */
window.LABS = ${JSON.stringify(labs, null, 2)};
`;

fs.writeFileSync(path.join(process.cwd(), "labs.js"), output);
console.log(`Wrote ${labs.length} labs to labs.js`);

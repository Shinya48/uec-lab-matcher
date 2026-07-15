(() => {
  "use strict";

  const dataService = window.LabMatcherDataService;
  const appConfig = window.LAB_MATCHER_CONFIG || {};

  const QUESTIONS = [
    {
      axis: "横軸：人・社会 ↔ 技術・計算",
      left: "人や社会がどのように動くのかを知りたい",
      right: "コンピュータやAIがどのように動くのかを知りたい"
    },
    {
      axis: "横軸：人・社会 ↔ 技術・計算",
      left: "人の困りごとや使いやすさを改善したい",
      right: "計算方法やシステムの性能を改善したい"
    },
    {
      axis: "横軸：人・社会 ↔ 技術・計算",
      left: "観察・インタビュー・アンケートで人について調べたい",
      right: "プログラミングやデータ分析で技術について調べたい"
    },
    {
      axis: "横軸：人・社会 ↔ 技術・計算",
      left: "技術が人や社会に与える影響に関心がある",
      right: "技術そのものの仕組みや性能に関心がある"
    },
    {
      axis: "横軸：人・社会 ↔ 技術・計算",
      left: "人に合わせた技術や仕組みを考えたい",
      right: "新しく高度な技術や計算手法を生み出したい"
    },
    {
      axis: "縦軸：理論 ↔ 実践・ものづくり",
      left: "原理や法則を明らかにしたい",
      right: "実際に動くものを作りたい"
    },
    {
      axis: "縦軸：理論 ↔ 実践・ものづくり",
      left: "数式・モデル・仮説を考えたい",
      right: "試作品や実験装置を作って確かめたい"
    },
    {
      axis: "縦軸：理論 ↔ 実践・ものづくり",
      left: "十分に考えてから実験や検証を始めたい",
      right: "まず試して、結果を見ながら改善したい"
    },
    {
      axis: "縦軸：理論 ↔ 実践・ものづくり",
      left: "現象を正しく説明・予測できることを重視したい",
      right: "実際の場面で使える成果を生み出すことを重視したい"
    },
    {
      axis: "縦軸：理論 ↔ 実践・ものづくり",
      left: "分析やシミュレーションを中心に取り組みたい",
      right: "実験・実装・工作を中心に取り組みたい"
    }
  ];

  const INTEREST_TAGS = [
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

  // 回答者がいない段階でもグラフを評価できるようにした、明示的なデモ分布。
  const DEMO_RESPONSES = [
    [-70, 55], [-58, 18], [-52, -46], [-45, 72], [-38, -20], [-30, 35],
    [-24, -70], [-15, 8], [-8, 48], [0, -8], [8, 18], [14, 68],
    [22, -54], [28, 38], [34, 82], [40, 5], [48, -28], [55, 60],
    [62, -72], [68, 22], [75, 48], [82, -44], [88, 8], [92, 74]
  ].map(([x, y], index) => ({ id: `demo-${index}`, x, y, demo: true }));

  const state = {
    page: "intro",
    questionIndex: 0,
    answers: Array(QUESTIONS.length).fill(null),
    selectedTags: [],
    result: null,
    comparisonResponses: dataService.loadLocalResponses(),
    dataInfo: {
      mode: dataService.isCloudConfigured() ? "loading" : "local",
      localCount: dataService.loadLocalResponses().length,
      cloudCount: 0,
      error: null
    }
  };

  const app = document.getElementById("app");
  let questionAdvanceTimer = null;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function makeResponseId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function getDataModeLabel() {
    if (state.dataInfo.mode === "cloud") return "共有データベース接続中";
    if (state.dataInfo.mode === "loading") return "共有データを読み込み中";
    if (state.dataInfo.mode === "local-fallback") return "通信失敗：端末内データを使用";
    return "端末内データのみ";
  }

  function getComparisonDescription() {
    const demoCount = appConfig.useDemoData ? DEMO_RESPONSES.length : 0;
    const actualCount = state.comparisonResponses.length;
    if (state.dataInfo.mode === "cloud") {
      return `${demoCount > 0 ? `デモ回答${demoCount}件＋` : ""}共有匿名回答${actualCount}件を表示`;
    }
    return `${demoCount > 0 ? `デモ回答${demoCount}件＋` : ""}この端末の匿名回答${actualCount}件を表示`;
  }

  async function refreshComparisonData({ rerender = true } = {}) {
    state.dataInfo = { ...state.dataInfo, mode: dataService.isCloudConfigured() ? "loading" : "local" };
    if (rerender) render();

    const result = await dataService.loadComparisonResponses();
    state.comparisonResponses = result.responses;
    state.dataInfo = {
      mode: result.mode,
      localCount: result.localCount,
      cloudCount: result.cloudCount,
      error: result.error
    };

    if (rerender) render();
    return result;
  }

  function calculatePosition(answers) {
    const scale = answers.map(value => value - 3); // 1..5 -> -2..2
    const xAverage = scale.slice(0, 5).reduce((sum, value) => sum + value, 0) / 5;
    const yAverage = scale.slice(5, 10).reduce((sum, value) => sum + value, 0) / 5;
    return {
      x: Math.round(xAverage * 50),
      y: Math.round(yAverage * 50)
    };
  }

  function coordinateSimilarity(user, lab) {
    const distance = Math.hypot(user.x - lab.x, user.y - lab.y);
    const maxDistance = Math.hypot(200, 200);
    return clamp(1 - distance / maxDistance, 0, 1);
  }

  function tagSimilarity(userTags, labTags) {
    if (userTags.length === 0) return 0.35;
    const matched = userTags.filter(tag => labTags.includes(tag)).length;
    return matched / userTags.length;
  }

  function calculateMatches(position, selectedTags) {
    return window.LABS
      .map(lab => {
        const coordinateScore = coordinateSimilarity(position, lab);
        const tagScore = tagSimilarity(selectedTags, lab.tags);
        const matchScore = Math.round((coordinateScore * 0.42 + tagScore * 0.58) * 100);
        const matchedTags = selectedTags.filter(tag => lab.tags.includes(tag));
        return { ...lab, matchScore, matchedTags, coordinateScore, tagScore };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.coordinateScore - a.coordinateScore);
  }

  function countRecommendations(matches, key) {
    const counts = new Map();
    matches.slice(0, 12).forEach((lab, index) => {
      const values = String(lab[key] || "")
        .split("／")
        .map(value => value.trim())
        .filter(Boolean);
      const weight = Math.max(1, 12 - index) * lab.matchScore;

      values.forEach(value => {
        counts.set(value, (counts.get(value) || 0) + weight);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 3)
      .map(([name]) => name);
  }

  function getAcademicRecommendations(matches) {
    return {
      clusters: countRecommendations(matches, "cluster"),
      programs: countRecommendations(matches, "program")
    };
  }

  function renderAcademicRecommendations(recommendations) {
    const clusters = recommendations.clusters.length > 0 ? recommendations.clusters : ["判定対象なし"];
    const programs = recommendations.programs.length > 0 ? recommendations.programs : ["判定対象なし"];

    return `
      <section class="recommendation-panel" aria-label="合っていそうな類とプログラム">
        <div>
          <p class="recommendation-kicker">ACADEMIC FIT</p>
          <h2>合っていそうな類・プログラム</h2>
          <p>上位候補の研究室から、あなたの興味に近い所属を集計しました。</p>
        </div>
        <div class="recommendation-columns">
          <div>
            <h3>類</h3>
            <div class="recommendation-tags">
              ${clusters.map(cluster => `<span>${escapeHtml(cluster)}</span>`).join("")}
            </div>
          </div>
          <div>
            <h3>プログラム</h3>
            <div class="recommendation-tags">
              ${programs.map(program => `<span>${escapeHtml(program)}</span>`).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function getType(position) {
    const center = Math.abs(position.x) < 15 && Math.abs(position.y) < 15;
    if (center) {
      return {
        name: "分野横断型リサーチャー",
        description: "人・社会と技術、理論と実践を幅広く見渡すバランス型です。複数分野を組み合わせる研究と相性があります。"
      };
    }
    if (position.x < 0 && position.y >= 0) {
      return {
        name: "人間支援クリエイター",
        description: "人や社会への関心を起点に、実験やシステム開発を通して課題を解決する傾向があります。"
      };
    }
    if (position.x >= 0 && position.y >= 0) {
      return {
        name: "テクノロジー開発者",
        description: "技術への関心が高く、実際に動くシステムや装置を作りながら探究する傾向があります。"
      };
    }
    if (position.x < 0 && position.y < 0) {
      return {
        name: "人間・社会探究者",
        description: "人や社会の仕組みを、理論・モデル・分析を通して深く理解する傾向があります。"
      };
    }
    return {
      name: "数理・計算探究者",
      description: "数理や計算技術への関心が高く、理論やアルゴリズムを深く掘り下げる傾向があります。"
    };
  }

  function positionPhrase(position) {
    const horizontal = position.x <= -40 ? "人・社会志向が強い" :
      position.x < -14 ? "やや人・社会志向" :
      position.x <= 14 ? "人・社会と技術・計算のバランス型" :
      position.x < 40 ? "やや技術・計算志向" : "技術・計算志向が強い";

    const vertical = position.y <= -40 ? "理論志向が強い" :
      position.y < -14 ? "やや理論志向" :
      position.y <= 14 ? "理論と実践のバランス型" :
      position.y < 40 ? "やや実践・ものづくり志向" : "実践・ものづくり志向が強い";

    return `${horizontal}、${vertical}位置です。`;
  }

  function renderIntro() {
    const responseCount = state.comparisonResponses.length;
    app.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">UEC OPEN CAMPUS PROTOTYPE</p>
          <h1>興味の位置から、<br>研究室を見つけよう。</h1>
          <p class="lead">10問の二択尺度と興味分野への回答から、あなたの研究志向を2次元グラフに表示し、公式一覧に掲載された${window.LABS.length}研究室から特徴の近い研究室を提案します。</p>
          <div class="actions">
            <button class="btn" id="startButton">診断を始める</button>
          </div>
          <div class="info-grid" aria-label="診断の概要">
            <div class="info-item"><strong>10問</strong><span>研究志向の質問</span></div>
            <div class="info-item"><strong>約2分</strong><span>回答時間の目安</span></div>
            <div class="info-item"><strong>${window.LABS.length}室</strong><span>マッチング対象</span></div>
            <div class="info-item"><strong>${responseCount}件</strong><span>${state.dataInfo.mode === "cloud" ? "共有匿名回答" : "比較に使える回答"}</span></div>
          </div>
        </div>
        <aside class="hero-card">
          <h2>2つの軸で興味を可視化</h2>
          <div class="axis-preview" aria-hidden="true">
            <span class="axis-label top">実践・ものづくり</span>
            <span class="axis-label bottom">理論</span>
            <span class="axis-label left">人・社会</span>
            <span class="axis-label right">技術・計算</span>
            <span class="preview-dot"></span>
          </div>
          <p class="notice">全研究室の座標・タグは公式の短い紹介文と所属プログラムから自動推定した暫定値です。公開前に研究室側の確認を受ける想定です。</p>
          <p class="data-status ${state.dataInfo.mode === "cloud" ? "online" : ""}">
            <span class="status-dot"></span>${escapeHtml(getDataModeLabel())}
          </p>
        </aside>
      </section>
    `;

    document.getElementById("startButton").addEventListener("click", () => {
      state.page = "questions";
      state.questionIndex = 0;
      render();
    });
  }

  function renderQuestion() {
    const index = state.questionIndex;
    const question = QUESTIONS[index];
    const selected = state.answers[index];
    const progress = Math.round(((index + 1) / QUESTIONS.length) * 100);

    function advanceQuestion() {
      if (state.answers[index] == null) return;
      if (index < QUESTIONS.length - 1) {
        state.questionIndex += 1;
        render();
      } else {
        state.page = "tags";
        render();
      }
    }

    app.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-meta">
          <span>研究志向の質問</span>
          <strong>${index + 1} / ${QUESTIONS.length}</strong>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
      </div>
      <section class="question-card">
        <span class="axis-chip">${escapeHtml(question.axis)}</span>
        <h2 class="question-title">どちらの考えに近いですか？</h2>
        <div class="scale-labels">
          <span>${escapeHtml(question.left)}</span>
          <span>${escapeHtml(question.right)}</span>
        </div>
        <div class="scale-options orb-scale" role="radiogroup" aria-label="5段階で回答">
          ${[1,2,3,4,5].map(value => `
            <div class="scale-option">
              <input type="radio" name="scale" id="scale-${value}" value="${value}" ${selected === value ? "checked" : ""}>
              <label class="scale-orb-label scale-orb-${value}" for="scale-${value}">
                <span class="choice-orb" aria-hidden="true"></span>
                <span class="sr-only">${value}</span>
              </label>
            </div>
          `).join("")}
        </div>
        <div class="scale-hint"><span>左にかなり近い</span><span>右にかなり近い</span></div>
        <div class="question-actions">
          <button class="btn secondary" id="backButton" ${index === 0 ? "disabled" : ""}>戻る</button>
          <button class="btn" id="nextButton" ${selected == null ? "disabled" : ""}>${index === QUESTIONS.length - 1 ? "興味分野へ" : "次へ"}</button>
        </div>
      </section>
    `;

    document.querySelectorAll('input[name="scale"]').forEach(input => {
      input.addEventListener("change", event => {
        state.answers[index] = Number(event.target.value);
        document.getElementById("nextButton").disabled = false;
        document.querySelector(".question-card").classList.add("is-exiting");
        clearTimeout(questionAdvanceTimer);
        questionAdvanceTimer = setTimeout(advanceQuestion, 240);
      });
    });

    document.getElementById("backButton").addEventListener("click", () => {
      clearTimeout(questionAdvanceTimer);
      if (state.questionIndex > 0) {
        state.questionIndex -= 1;
        render();
      }
    });

    document.getElementById("nextButton").addEventListener("click", () => {
      clearTimeout(questionAdvanceTimer);
      advanceQuestion();
    });
  }

  function renderTags() {
    app.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-meta"><span>興味分野</span><strong>最後の質問</strong></div>
        <div class="progress-track"><div class="progress-bar" style="width:100%"></div></div>
      </div>
      <section class="question-card">
        <span class="axis-chip">研究室とのマッチングに使用</span>
        <h2>興味のある分野を選んでください</h2>
        <p class="lead">最大3つまで選択できます。まだ絞れていない場合は、気になるものを直感で選んで大丈夫です。</p>
        <div class="tags-grid">
          ${INTEREST_TAGS.map((tag, index) => {
            const checked = state.selectedTags.includes(tag);
            const disabled = !checked && state.selectedTags.length >= 3;
            return `
              <div class="tag-option">
                <input type="checkbox" id="tag-${index}" value="${escapeHtml(tag)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
                <label for="tag-${index}">${escapeHtml(tag)}</label>
              </div>
            `;
          }).join("")}
        </div>
        <p id="tagCounter" class="notice">${state.selectedTags.length} / 3 選択中</p>
        <div class="question-actions">
          <button class="btn secondary" id="backButton">戻る</button>
          <button class="btn" id="resultButton" ${state.selectedTags.length === 0 ? "disabled" : ""}>診断結果を見る</button>
        </div>
      </section>
    `;

    document.querySelectorAll('.tag-option input').forEach(input => {
      input.addEventListener("change", event => {
        const tag = event.target.value;
        if (event.target.checked) {
          if (state.selectedTags.length < 3) state.selectedTags.push(tag);
        } else {
          state.selectedTags = state.selectedTags.filter(value => value !== tag);
        }
        renderTags();
      });
    });

    document.getElementById("backButton").addEventListener("click", () => {
      clearTimeout(questionAdvanceTimer);
      state.page = "questions";
      state.questionIndex = QUESTIONS.length - 1;
      render();
    });

    document.getElementById("resultButton").addEventListener("click", async () => {
      if (state.selectedTags.length === 0 || state.answers.some(value => value == null)) return;

      const button = document.getElementById("resultButton");
      button.disabled = true;
      button.textContent = "結果を作成中…";

      const position = calculatePosition(state.answers);
      const matches = calculateMatches(position, state.selectedTags);
      const type = getType(position);
      const response = {
        id: makeResponseId(),
        x: position.x,
        y: position.y,
        tags: [...state.selectedTags],
        answeredAt: new Date().toISOString()
      };

      const saveResult = await dataService.saveResponse(response);
      await refreshComparisonData({ rerender: false });
      state.result = { position, matches, type, saveResult, response };
      state.page = "result";
      render();
    });
  }

  function renderChart(position, matches) {
    const width = 720;
    const height = 620;
    const margin = { top: 52, right: 70, bottom: 62, left: 70 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const mapX = x => margin.left + ((x + 100) / 200) * plotW;
    const mapY = y => margin.top + ((100 - y) / 200) * plotH;

    const comparison = state.comparisonResponses;
    const responders = [
      ...(appConfig.useDemoData ? DEMO_RESPONSES : []),
      ...comparison
    ];
    const topLabs = matches.slice(0, 3);

    const gridLines = [-100, -50, 0, 50, 100].map(value => `
      <line x1="${mapX(value)}" y1="${margin.top}" x2="${mapX(value)}" y2="${height - margin.bottom}" stroke="${value === 0 ? "#7b8085" : "#e0e2e4"}" stroke-width="${value === 0 ? 1.5 : 1}" />
      <line x1="${margin.left}" y1="${mapY(value)}" x2="${width - margin.right}" y2="${mapY(value)}" stroke="${value === 0 ? "#7b8085" : "#e0e2e4"}" stroke-width="${value === 0 ? 1.5 : 1}" />
    `).join("");

    const responderDots = responders.map(item => `
      <circle cx="${mapX(item.x)}" cy="${mapY(item.y)}" r="${item.demo ? 3.5 : 4.5}" fill="${item.demo ? "#c4c7ca" : "#8c9196"}" opacity="${item.demo ? .68 : .9}">
        <title>${item.demo ? "デモ回答" : "匿名回答"} (${item.x}, ${item.y})</title>
      </circle>
    `).join("");

    const labMarks = topLabs.map((lab, index) => {
      const x = mapX(lab.x);
      const y = mapY(lab.y);
      const size = 7;
      return `
        <g>
          <rect x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}" rx="2" fill="#555" transform="rotate(45 ${x} ${y})">
            <title>${escapeHtml(lab.name)} (${lab.x}, ${lab.y})</title>
          </rect>
          <text x="${x + 12}" y="${y - 10}" font-size="12" font-weight="700" fill="#333">${index + 1}. ${escapeHtml(lab.name)}</text>
        </g>
      `;
    }).join("");

    return `
      <svg class="interest-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="回答者とおすすめ研究室の興味分布グラフ">
        <rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#b6babf" />
        ${gridLines}
        ${responderDots}
        ${labMarks}
        <circle cx="${mapX(position.x)}" cy="${mapY(position.y)}" r="11" fill="#111" stroke="#fff" stroke-width="4">
          <title>あなた (${position.x}, ${position.y})</title>
        </circle>
        <circle cx="${mapX(position.x)}" cy="${mapY(position.y)}" r="13" fill="none" stroke="#111" stroke-width="1.5" />
        <text x="${mapX(position.x) + 17}" y="${mapY(position.y) + 5}" font-size="13" font-weight="800" fill="#111">あなた</text>

        <text x="${width / 2}" y="25" text-anchor="middle" font-size="15" font-weight="800">実践・ものづくり</text>
        <text x="${width / 2}" y="${height - 15}" text-anchor="middle" font-size="15" font-weight="800">理論</text>
        <text x="15" y="${height / 2}" text-anchor="middle" font-size="15" font-weight="800" transform="rotate(-90 15 ${height / 2})">人・社会</text>
        <text x="${width - 15}" y="${height / 2}" text-anchor="middle" font-size="15" font-weight="800" transform="rotate(90 ${width - 15} ${height / 2})">技術・計算</text>
      </svg>
    `;
  }

  function describeHorizontal(value) {
    if (value <= -40) return "人・社会志向が強い";
    if (value < -14) return "やや人・社会志向";
    if (value <= 14) return "人・社会と技術・計算の中間";
    if (value < 40) return "やや技術・計算志向";
    return "技術・計算志向が強い";
  }

  function describeVertical(value) {
    if (value <= -40) return "理論志向が強い";
    if (value < -14) return "やや理論志向";
    if (value <= 14) return "理論と実践・ものづくりの中間";
    if (value < 40) return "やや実践・ものづくり志向";
    return "実践・ものづくり志向が強い";
  }

  function alignmentLabel(difference) {
    if (difference <= 15) return "非常に近い";
    if (difference <= 35) return "近い";
    if (difference <= 60) return "一部近い";
    return "異なる";
  }

  function buildMatchExplanation(lab, position) {
    const matchedCount = lab.matchedTags.length;
    const selectedCount = state.selectedTags.length;
    const coordinatePercent = Math.round(lab.coordinateScore * 100);
    const tagPercent = Math.round(lab.tagScore * 100);
    const coordinateContribution = Math.round(lab.coordinateScore * 42);
    const tagContribution = Math.round(lab.tagScore * 58);
    const xDifference = Math.abs(position.x - lab.x);
    const yDifference = Math.abs(position.y - lab.y);

    const tagSentence = matchedCount > 0
      ? `選択した${selectedCount}分野のうち${matchedCount}分野（${lab.matchedTags.join("、")}）が研究室タグと一致しています。`
      : `選択した分野との完全一致はありませんが、研究志向の座標が近いため候補に入りました。`;

    const xSentence = `横軸は、あなたが「${describeHorizontal(position.x)}（x=${position.x}）」、研究室が「${describeHorizontal(lab.x)}（x=${lab.x}）」で、差は${xDifference}です。横方向の傾向は${alignmentLabel(xDifference)}と判定しました。`;
    const ySentence = `縦軸は、あなたが「${describeVertical(position.y)}（y=${position.y}）」、研究室が「${describeVertical(lab.y)}（y=${lab.y}）」で、差は${yDifference}です。研究の進め方は${alignmentLabel(yDifference)}と判定しました。`;
    const summarySentence = `判定に使用した研究内容は「${lab.summary}」です。登録タグは「${lab.tags.join("、")}」です。`;

    let primaryReason;
    if (matchedCount >= 2 && coordinatePercent >= 80) {
      primaryReason = "興味分野と研究スタイルの両方が強く一致したためです。";
    } else if (matchedCount >= 2) {
      primaryReason = "選択した興味分野との一致が大きかったためです。";
    } else if (coordinatePercent >= 85) {
      primaryReason = "人・社会／技術・計算、理論／実践の位置が近かったためです。";
    } else if (matchedCount === 1) {
      primaryReason = "興味分野が一部一致し、研究スタイルにも共通点があったためです。";
    } else {
      primaryReason = "他の研究室と比較して、2次元上の研究志向が近かったためです。";
    }

    return {
      primaryReason,
      tagSentence,
      xSentence,
      ySentence,
      summarySentence,
      coordinatePercent,
      tagPercent,
      coordinateContribution,
      tagContribution
    };
  }

  function renderMatchExplanation(lab, position) {
    const explanation = buildMatchExplanation(lab, position);
    return `
      <div class="reason-box">
        <p class="reason-title">推薦の主な理由</p>
        <p class="reason-lead">${escapeHtml(explanation.primaryReason)}</p>
        <ul class="reason-list">
          <li><strong>興味分野：</strong>${escapeHtml(explanation.tagSentence)}</li>
          <li><strong>横軸：</strong>${escapeHtml(explanation.xSentence)}</li>
          <li><strong>縦軸：</strong>${escapeHtml(explanation.ySentence)}</li>
          <li><strong>研究内容：</strong>${escapeHtml(explanation.summarySentence)}</li>
        </ul>
        <div class="score-breakdown" aria-label="相性スコアの内訳">
          <div class="breakdown-row">
            <div class="breakdown-label"><span>興味分野の一致</span><strong>${explanation.tagPercent}%</strong></div>
            <div class="breakdown-track"><span style="width:${explanation.tagPercent}%"></span></div>
            <small>${explanation.tagPercent}% × 重み58% ＝ ${explanation.tagContribution}点</small>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-label"><span>研究志向の近さ</span><strong>${explanation.coordinatePercent}%</strong></div>
            <div class="breakdown-track"><span style="width:${explanation.coordinatePercent}%"></span></div>
            <small>${explanation.coordinatePercent}% × 重み42% ＝ ${explanation.coordinateContribution}点</small>
          </div>
        </div>
        <p class="calculation-note">総合相性 ${lab.matchScore}% ＝ 分野一致${explanation.tagContribution}点 ＋ 研究志向${explanation.coordinateContribution}点（四捨五入により合計が1点ずれる場合があります）</p>
      </div>
    `;
  }

  function renderResult() {
    const { position, matches, type, saveResult } = state.result;
    const responseCount = state.comparisonResponses.length;
    const topThree = matches.slice(0, 3);
    const academicRecommendations = getAcademicRecommendations(matches);

    app.innerHTML = `
      <section class="result-header">
        <div>
          <p class="eyebrow">YOUR RESEARCH INTEREST</p>
          <span class="result-type">${escapeHtml(type.name)}</span>
          <h1>あなたの研究志向</h1>
          <p class="lead">${escapeHtml(type.description)} ${escapeHtml(positionPhrase(position))}</p>
          <div class="score-pills">
            <span class="score-pill">横軸 x = ${position.x}</span>
            <span class="score-pill">縦軸 y = ${position.y}</span>
            ${state.selectedTags.map(tag => `<span class="score-pill">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div class="actions">
          <button class="btn secondary" id="restartButton">もう一度診断</button>
        </div>
      </section>

      <section class="results-grid">
        <div>
          <div class="chart-card">
            <div class="chart-head">
              <div>
                <h2>参加者の中での位置</h2>
                <p>${escapeHtml(getComparisonDescription())}</p>
              </div>
            </div>
            <div class="chart-wrap">${renderChart(position, matches)}</div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot"></span>デモ／匿名回答</span>
              <span class="legend-item"><span class="legend-dot you"></span>あなた</span>
              <span class="legend-item"><span class="legend-square"></span>おすすめ研究室</span>
            </div>
          </div>
          <p class="notice">
            <strong>${escapeHtml(getDataModeLabel())}</strong><br>
            ${state.dataInfo.mode === "cloud"
              ? `複数端末で共有された匿名回答${responseCount}件を比較に使用しています。`
              : "現在はこの端末に保存された回答を比較に使用しています。config.jsへSupabaseの接続情報を設定すると、複数端末で共有できます。"}
          </p>
          ${renderAcademicRecommendations(academicRecommendations)}
          <div class="data-panel">
            <h3>開発者向け：この端末の回答データ</h3>
            <p>${saveResult.saved
              ? (saveResult.source === "cloud" ? "今回の座標を共有データベースへ匿名で保存しました。" : "今回の座標を端末内へ匿名で保存しました。")
              : "回答の保存に失敗しました。診断結果の表示には影響ありません。"}</p>
            <button class="btn danger" id="clearDataButton">この端末の保存データを削除</button>
            <p class="tiny-note">共有データベースへ送信済みの回答は、このボタンでは削除されません。</p>
          </div>
        </div>

        <aside class="ranking-panel">
          <h2>おすすめ研究室</h2>
          ${topThree.map((lab, index) => `
            <article class="result-card">
              <div class="rank-line">
                <span class="rank-number">MATCH ${index + 1}</span>
                <span class="match-score">${lab.matchScore}%</span>
              </div>
              <div class="match-meter" aria-label="適合度 ${lab.matchScore}%">
                <span style="width:${lab.matchScore}%"></span>
              </div>
              <h3>${escapeHtml(lab.name)}</h3>
              <p class="teacher">担当教員：${escapeHtml(lab.teacher)}</p>
              <p class="program">${escapeHtml(lab.cluster)}｜${escapeHtml(lab.program)}</p>
              <p class="summary">${escapeHtml(lab.summary)}</p>
              ${renderMatchExplanation(lab, position)}
              <div class="tag-list">${lab.tags.map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("")}</div>
              <div class="lab-url">
                <span>Webページ</span>
                <a class="lab-link-button" href="${escapeHtml(lab.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(lab.urlLabel || "研究室サイトを見る")}</a>
              </div>
            </article>
          `).join("")}
        </aside>
      </section>
    `;

    document.getElementById("restartButton").addEventListener("click", resetDiagnosis);
    document.getElementById("clearDataButton").addEventListener("click", async () => {
      dataService.clearLocalResponses();
      await refreshComparisonData({ rerender: false });
      renderResult();
    });
  }

  function resetDiagnosis() {
    state.page = "intro";
    state.questionIndex = 0;
    state.answers = Array(QUESTIONS.length).fill(null);
    state.selectedTags = [];
    state.result = null;
    clearTimeout(questionAdvanceTimer);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    if (state.page === "intro") renderIntro();
    else if (state.page === "questions") renderQuestion();
    else if (state.page === "tags") renderTags();
    else if (state.page === "result") renderResult();
  }

  document.querySelector(".brand").addEventListener("click", event => {
    event.preventDefault();
    resetDiagnosis();
  });

  render();
  refreshComparisonData();
})();

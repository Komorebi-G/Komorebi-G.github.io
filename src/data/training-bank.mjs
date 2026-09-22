const cf = (contestId, index, title, rating, skill) => ({
  id: `${contestId}${index}`,
  platform: "Codeforces",
  contestId,
  index,
  title,
  rating,
  skill,
  url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
});

export const trainingSkillLabels = {
  foundation: "基础实现",
  search: "二分与双指针",
  greedy: "贪心",
  graph: "图论",
  dp: "动态规划",
  dataStructures: "数据结构",
  math: "数学",
  string: "字符串",
  bitwise: "位运算",
};

// 首批题池刻意选用完成量较高、题意相对稳定的经典题。rating 仅用于组卷梯度，
// 不是 ICPC / CCPC 奖牌线。标签在交卷前不会展示，避免泄露解法方向。
export const cfDrillBank = [
  cf(4, "C", "Registration System", 1300, "foundation"),
  cf(230, "B", "T-primes", 1300, "math"),
  cf(279, "B", "Books", 1400, "search"),
  cf(1201, "C", "Maximum Median", 1400, "search"),
  cf(580, "B", "Kefa and Company", 1500, "search"),
  cf(371, "C", "Hamburgers", 1600, "search"),
  cf(276, "C", "Little Girl and Maximum Sum", 1500, "greedy"),
  cf(1526, "C2", "Potions (Hard Version)", 1600, "greedy"),
  cf(580, "C", "Kefa and Park", 1500, "graph"),
  cf(1167, "C", "News Distribution", 1400, "graph"),
  cf(510, "C", "Fox And Names", 1600, "graph"),
  cf(1365, "D", "Solve The Maze", 1700, "graph"),
  cf(455, "A", "Boredom", 1500, "dp"),
  cf(1398, "C", "Good Subarrays", 1600, "dp"),
  cf(706, "C", "Hard problem", 1600, "dp"),
  cf(1528, "A", "Parsa's Humongous Tree", 1600, "dp"),
  cf(339, "D", "Xenia and Bit Operations", 1700, "dataStructures"),
  cf(722, "C", "Destroying Array", 1600, "dataStructures"),
  cf(1458, "A", "Row GCD", 1600, "math"),
  cf(414, "B", "Mashmokh and ACM", 1400, "math"),
  cf(550, "A", "Two Substrings", 1500, "string"),
  cf(126, "B", "Password", 1700, "string"),
  cf(476, "B", "Dreamoon and WiFi", 1300, "math"),
  cf(1395, "C", "Boboniu and Bit Operations", 1600, "bitwise"),
  cf(466, "C", "Number of Ways", 1700, "search"),
  cf(448, "D", "Multiplication Table", 1800, "search"),
  cf(61, "E", "Enemy is weak", 1900, "dataStructures"),
  cf(706, "D", "Vasiliy's Multiset", 1800, "dataStructures"),
  cf(25, "D", "Roads not only in Berland", 1900, "graph"),
  cf(161, "D", "Distance in Tree", 1800, "graph"),
  cf(427, "C", "Checkposts", 1700, "graph"),
  cf(295, "B", "Greg and Graph", 1700, "graph"),
  cf(20, "C", "Dijkstra?", 1900, "graph"),
  cf(598, "D", "Igor In the Museum", 1700, "graph"),
  cf(474, "D", "Flowers", 1700, "dp"),
  cf(977, "F", "Consecutive Subsequence", 1700, "dp"),
  cf(118, "D", "Caesar's Legions", 1700, "dp"),
  cf(577, "B", "Modulo Sum", 1900, "dp"),
  cf(1036, "C", "Classy Numbers", 1900, "dp"),
  cf(5, "C", "Longest Regular Bracket Sequence", 1900, "string"),
  cf(271, "D", "Good Substrings", 1800, "string"),
  cf(1516, "C", "Baby Ehab Partitions Again", 1700, "bitwise"),
  cf(1325, "D", "Ehab the Xorcist", 1700, "bitwise"),
  cf(1305, "C", "Kuroni and Impossible Calculation", 1600, "math"),
  cf(1833, "E", "Round Dance", 1600, "graph"),
  cf(1702, "E", "Split Into Two Sets", 1600, "graph"),
  cf(1872, "E", "Data Structures Fan", 1500, "bitwise"),
];

export const cfDrillModes = [
  {
    id: "diagnostic",
    name: "定位赛",
    kicker: "第一次先做这个",
    durationMinutes: 150,
    description: "从不同难度区间各取一题，用于记录速度、基础题完成率和较难题完成率。",
    slots: [[1300, 1400], [1400, 1500], [1500, 1600], [1600, 1700], [1700, 1800]],
  },
  {
    id: "bronze",
    name: "稳铜专项",
    kicker: "120 分钟 · 4 题",
    durationMinutes: 120,
    description: "练前中段题的识别与一次写对，目标是把应拿的题稳定拿完。",
    slots: [[1300, 1400], [1400, 1500], [1500, 1600], [1500, 1600]],
  },
  {
    id: "silver",
    name: "冲银专项",
    kicker: "180 分钟 · 5 题",
    durationMinutes: 180,
    description: "保留一题速度题，把主要时间压到图论、DP 和数据结构的中档题。",
    slots: [[1500, 1600], [1600, 1700], [1700, 1800], [1800, 1900], [1800, 1900]],
  },
];

export const trainingBankMeta = {
  updatedAt: "2026-09-23",
  source: "2024 ICPC / CCPC 区域赛真题与 XCPCIO 正式队榜单",
  methodology: "按正式队榜单复算各奖牌段过题率；分层描述的是该场比赛中的作用，不是题目的永久难度标签。",
};

const gym = (gymId, index, contest, role, solveRates) => ({
  id: `gym-${gymId}-${index}`,
  platform: "Codeforces Gym",
  gymId,
  index,
  title: `${contest} · Problem ${index}`,
  role,
  solveRates,
  url: `https://codeforces.com/problemset/gymProblem/${gymId}/${index}`,
});

// “铜牌关键题”和“银牌差异题”来自同一场真实区域赛的正式队榜单：前者是
// 铜牌队常见题集中相对靠后的题，后者在银牌段的通过率显著高于铜牌段。
// 它们是用于训练的榜单推导，不声称赛事官方给单题颁发了奖牌标签。
export const regionalRounds = [
  {
    id: "2024-icpc-hangzhou",
    name: "2024 ICPC 杭州站",
    officialTeams: 366,
    medalLine: { bronze: 4, silver: 5 },
    scoreboardUrl: "https://board.xcpcio.com/board/icpc/49th/hangzhou",
    bronze: gym(105657, "H", "2024 ICPC 杭州站", "bronze", { gold: 100, silver: 100, bronze: 91, all: 66 }),
    silver: gym(105657, "M", "2024 ICPC 杭州站", "silver", { gold: 100, silver: 96, bronze: 55, all: 49 }),
  },
  {
    id: "2024-icpc-nanjing",
    name: "2024 ICPC 南京站",
    officialTeams: 336,
    medalLine: { bronze: 3, silver: 4 },
    scoreboardUrl: "https://board.xcpcio.com/board/icpc/49th/nanjing",
    bronze: gym(105484, "K", "2024 ICPC 南京站", "bronze", { gold: 100, silver: 97, bronze: 84, all: 63 }),
    silver: gym(105484, "G", "2024 ICPC 南京站", "silver", { gold: 100, silver: 87, bronze: 37, all: 40 }),
  },
  {
    id: "2024-icpc-shenyang",
    name: "2024 ICPC 沈阳站",
    officialTeams: 300,
    medalLine: { bronze: 2, silver: 4 },
    scoreboardUrl: "https://board.xcpcio.com/board/icpc/49th/shenyang",
    bronze: gym(105578, "D", "2024 ICPC 沈阳站", "bronze", { gold: 100, silver: 100, bronze: 69, all: 57 }),
    silver: gym(105578, "M", "2024 ICPC 沈阳站", "silver", { gold: 100, silver: 83, bronze: 10, all: 30 }),
  },
  {
    id: "2024-icpc-chengdu",
    name: "2024 ICPC 成都站",
    officialTeams: 307,
    medalLine: { bronze: 5, silver: 6 },
    scoreboardUrl: "https://board.xcpcio.com/board/icpc/49th/chengdu",
    bronze: gym(105486, "I", "2024 ICPC 成都站", "bronze", { gold: 100, silver: 100, bronze: 87, all: 58 }),
    silver: gym(105486, "B", "2024 ICPC 成都站", "silver", { gold: 100, silver: 100, bronze: 49, all: 45 }),
  },
  {
    id: "2024-ccpc-jinan",
    name: "2024 CCPC 济南站",
    officialTeams: 280,
    medalLine: { bronze: 4, silver: 5 },
    scoreboardUrl: "https://board.xcpcio.com/board/ccpc/10th/jinan",
    bronze: gym(105540, "F", "2024 CCPC 济南站", "bronze", { gold: 100, silver: 98, bronze: 82, all: 57 }),
    silver: gym(105540, "I", "2024 CCPC 济南站", "silver", { gold: 100, silver: 98, bronze: 56, all: 46 }),
  },
  {
    id: "2024-ccpc-harbin",
    name: "2024 CCPC 哈尔滨站",
    officialTeams: 280,
    medalLine: { bronze: 5, silver: 5, penaltyDecides: true },
    scoreboardUrl: "https://board.xcpcio.com/board/ccpc/10th/harbin",
    bronze: gym(105459, "J", "2024 CCPC 哈尔滨站", "bronze", { gold: 100, silver: 100, bronze: 95, all: 61 }),
    silver: gym(105459, "A", "2024 CCPC 哈尔滨站", "silver", { gold: 93, silver: 59, bronze: 2, all: 22 }),
  },
  {
    id: "2024-ccpc-zhengzhou",
    name: "2024 CCPC 郑州站",
    officialTeams: 280,
    medalLine: { bronze: 4, silver: 5 },
    scoreboardUrl: "https://board.xcpcio.com/board/ccpc/10th/zhengzhou",
    bronze: gym(105632, "M", "2024 CCPC 郑州站", "bronze", { gold: 100, silver: 100, bronze: 99, all: 70 }),
    silver: gym(105632, "C", "2024 CCPC 郑州站", "silver", { gold: 96, silver: 93, bronze: 17, all: 34 }),
  },
];

export const trainingBank = regionalRounds.flatMap((round) => [round.bronze, round.silver]);

export const trainingModes = [
  {
    id: "medal-run",
    name: "铜银连续测试",
    kicker: "主训练 · 240 分钟",
    durationMinutes: 240,
    roles: ["bronze", "silver"],
    description: "从同一场区域赛抽取一题铜牌关键题和一题银牌差异题，依次完成两题的代码。",
  },
  {
    id: "bronze-guard",
    name: "铜牌题专项",
    kicker: "单题 · 120 分钟",
    durationMinutes: 120,
    roles: ["bronze"],
    description: "单独训练铜牌队常见题集中相对靠后的题，不假设这部分已经稳定。",
  },
  {
    id: "silver-break",
    name: "银牌题专项",
    kicker: "单题 · 180 分钟",
    durationMinutes: 180,
    roles: ["silver"],
    description: "单独训练银牌段通过率明显高于铜牌段的题，给一题保留三小时。",
  },
];

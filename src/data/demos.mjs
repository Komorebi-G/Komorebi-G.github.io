export const demos = [
  {
    title: "最近点对",
    english: "Closest Pair",
    description: "回放递归分割、候选条带与点对比较，观察分治算法如何逐步收紧当前最优距离。",
    slug: "closest-pair",
    source: "exp2/output",
    dataFrom: "exp2",
  },
  {
    title: "图着色搜索",
    english: "Graph Coloring",
    description: "对照顺序回溯与 MRV + 前向检查，直观看见启发式策略如何压缩搜索空间。",
    slug: "graph-coloring",
    source: "exp3/visualization",
  },
  {
    title: "鸡蛋掉落",
    english: "Egg Dropping",
    description: "用三种动态规划策略处理经典最坏情况问题，比较状态定义、转移方式与计算成本。",
    slug: "egg-drop",
    source: "exp4/visualization",
  },
  {
    title: "桥检测",
    english: "Bridge Detection",
    description: "从逐边删除到并查集与在线算法，对照无向图中关键边的不同检测思路。",
    slug: "bridge",
    source: "exp5/visualization",
  },
  {
    title: "最大流",
    english: "Maximum Flow",
    description: "并排观察 Ford–Fulkerson、Dinic 与 Push–Relabel 的增广、分层和推流过程。",
    slug: "maxflow",
    source: "exp6/visualization",
  },
].map((demo, index) => ({ ...demo, index: String(index + 1).padStart(2, "0"), href: "/demos/" + demo.slug + "/index.html" }));

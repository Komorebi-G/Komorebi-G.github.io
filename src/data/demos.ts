export interface Demo {
  index: string;
  title: string;
  english: string;
  description: string;
  topics: string;
  href: string;
  tone: "orange" | "blue" | "green" | "yellow" | "black";
}

export const demos: Demo[] = [
  {
    index: "01",
    title: "最近点对",
    english: "Closest Pair",
    description: "回放递归分割、候选条带与点对比较，观察分治算法如何逐步收紧当前最优距离。",
    topics: "DIVIDE & CONQUER · O(N LOG N)",
    href: "/demos/closest-pair/index.html",
    tone: "yellow",
  },
  {
    index: "02",
    title: "图着色搜索",
    english: "Graph Coloring",
    description: "对照顺序回溯与 MRV + 前向检查，直观看见启发式策略如何压缩搜索空间。",
    topics: "BACKTRACKING · MRV · HEURISTIC",
    href: "/demos/graph-coloring/index.html",
    tone: "blue",
  },
  {
    index: "03",
    title: "鸡蛋掉落",
    english: "Egg Dropping",
    description: "用三种动态规划策略处理经典最坏情况问题，比较状态定义、转移方式与计算成本。",
    topics: "DYNAMIC PROGRAMMING · OPTIMIZATION",
    href: "/demos/egg-drop/index.html",
    tone: "orange",
  },
  {
    index: "04",
    title: "桥检测",
    english: "Bridge Detection",
    description: "从逐边删除到并查集与在线算法，对照无向图中关键边的不同检测思路。",
    topics: "GRAPH · DFS · DISJOINT SET",
    href: "/demos/bridge/index.html",
    tone: "green",
  },
  {
    index: "05",
    title: "最大流",
    english: "Maximum Flow",
    description: "并排观察 Ford–Fulkerson、Dinic 与 Push–Relabel 的增广、分层和推流过程。",
    topics: "NETWORK FLOW · DINIC · PUSH–RELABEL",
    href: "/demos/maxflow/index.html",
    tone: "black",
  },
];

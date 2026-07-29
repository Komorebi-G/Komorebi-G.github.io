window.BRIDGE_LAB = (() => {
  const algorithms = {
    brute: {
      id: "brute",
      name: "逐边删除 + DFS",
      short: "基准算法",
      complexity: "O(m(n+m))",
      state: "删除 e 后，比较连通块数量",
      pseudocode: [
        "base ← countComponents(G)",
        "for each edge e in G:",
        "    temporarily remove e",
        "    now ← countComponents(G − e)",
        "    if now > base:",
        "        mark e as bridge",
        "return all marked edges"
      ]
    },
    static: {
      id: "static",
      name: "生成森林 + 路径压缩",
      short: "主优化算法",
      complexity: "O((n+m) α(n))",
      state: "树边先暂定为桥；非树边覆盖的树路径全部取消标记",
      pseudocode: [
        "for each edge (u, v):",
        "    if build.unite(u, v): mark as tree edge",
        "    else: save as extra edge",
        "build parent[], depth[], parentEdge[]",
        "for each extra edge (a, b):",
        "    a ← findUp(a); b ← findUp(b)",
        "    while a ≠ b:",
        "        move the deeper endpoint upward",
        "        cancel parentEdge as bridge",
        "        up[x] ← findUp(parent[x])"
      ]
    },
    online: {
      id: "online",
      name: "在线双并查集",
      short: "扩展优化算法",
      complexity: "O(n log n + m α(n))",
      state: "dsu_cc 维护连通块；dsu_2ecc 维护 2-边连通分量",
      pseudocode: [
        "addEdge(a, b):",
        "    a ← find2ecc(a); b ← find2ecc(b)",
        "    if a = b: return",
        "    if findCC(a) ≠ findCC(b):",
        "        bridges++; makeRoot(smaller)",
        "        link the two component trees",
        "    else:",
        "        lca ← mergePath(a, b)",
        "        merge 2-edge-connected components",
        "        bridges -= merged path length"
      ]
    }
  };

  const cases = [
    {
      id: "double-cycle",
      name: "双环 + 两座桥",
      note: "两个环遮住大多数边，只有连接边与叶子边是桥。",
      teaching: "适合观察：删边法反复遍历；路径压缩只处理被环覆盖的树边。",
      nodes: [
        [0, 14, 30], [1, 8, 68], [2, 30, 66], [3, 48, 36],
        [4, 66, 14], [5, 74, 54], [6, 92, 72]
      ],
      edges: [[0,1],[1,2],[2,0],[0,3],[3,4],[4,5],[5,3],[5,6]]
    },
    {
      id: "dense-tail",
      name: "稠密核心 + 长尾",
      note: "K₅ 核心没有桥，尾链上的四条边全是桥。",
      teaching: "性能差异最明显：基准算法为每条边重跑 DFS。",
      nodes: [
        [0,12,24],[1,30,10],[2,40,42],[3,24,66],[4,6,54],
        [5,54,42],[6,67,42],[7,80,42],[8,93,42]
      ],
      edges: [
        [0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4],
        [2,5],[5,6],[6,7],[7,8]
      ]
    },
    {
      id: "late-cycle",
      name: "深链 + 回边",
      note: "DFS 先走入深链，最后一条回边一次性降低多个 low 值。",
      teaching: "适合观察：末端非树边形成大环，up[] 会跳过已处理路径。",
      nodes: [
        [0,8,18],[1,20,32],[2,32,46],[3,44,60],[4,56,74],
        [5,66,52],[6,76,30],[7,88,14],[8,92,48]
      ],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,2],[6,7],[6,8]]
    }
  ].map(c => ({
    ...c,
    nodes: c.nodes.map(([id,x,y]) => ({id,x,y})),
    edges: c.edges.map(([u,v], id) => ({id,u,v}))
  }));

  const clone = value => JSON.parse(JSON.stringify(value));

  function adjacency(sample, skipped = -1) {
    const adj = Array.from({length: sample.nodes.length}, () => []);
    sample.edges.forEach(e => {
      if (e.id === skipped) return;
      adj[e.u].push({to:e.v, edge:e.id});
      adj[e.v].push({to:e.u, edge:e.id});
    });
    return adj;
  }

  function componentCount(sample, skipped = -1) {
    const adj = adjacency(sample, skipped);
    const seen = Array(sample.nodes.length).fill(false);
    let count = 0;
    for (let s = 0; s < seen.length; s++) {
      if (seen[s]) continue;
      count++;
      const stack = [s];
      seen[s] = true;
      while (stack.length) {
        const u = stack.pop();
        adj[u].forEach(({to}) => {
          if (!seen[to]) {
            seen[to] = true;
            stack.push(to);
          }
        });
      }
    }
    return count;
  }

  function buildBrute(sample) {
    const states = Array(sample.edges.length).fill("neutral");
    const events = [];
    let work = 0;
    const base = componentCount(sample);
    const push = (data) => events.push({
      line: 0, activeNode: -1, activeEdge: -1, bridges: states.filter(x => x === "bridge").length,
      components: base, work, edgeState: clone(states), dfn: [], low: [], ...data
    });

    push({phase:"init", title:"计算原图连通块", detail:`原图共有 ${base} 个连通块。`, line:0});
    for (const edge of sample.edges) {
      states[edge.id] = "removed";
      push({
        phase:"remove", title:`临时删除 e${edge.id}`,
        detail:`检验 (${edge.u}, ${edge.v})：只改变这一条边。`,
        line:2, activeEdge:edge.id
      });

      const adj = adjacency(sample, edge.id);
      const seen = Array(sample.nodes.length).fill(false);
      let now = 0;
      for (let s = 0; s < seen.length; s++) {
        if (seen[s]) continue;
        now++;
        const stack = [s];
        seen[s] = true;
        while (stack.length) {
          const u = stack.pop();
          push({
            phase:"visit", title:`DFS 访问顶点 ${u}`,
            detail:`删除 e${edge.id} 后，第 ${now} 个连通块正在展开。`,
            line:3, activeNode:u, activeEdge:edge.id, components:now
          });
          for (const {to} of adj[u]) {
            work++;
            if (!seen[to]) {
              seen[to] = true;
              stack.push(to);
            }
          }
        }
      }
      states[edge.id] = now > base ? "bridge" : "safe";
      push({
        phase:"judge",
        title: now > base ? `e${edge.id} 是桥` : `e${edge.id} 不是桥`,
        detail: now > base
          ? `连通块 ${base} → ${now}，删除后图被分开。`
          : `连通块仍为 ${base}，它位于某个环上。`,
        line: now > base ? 5 : 4, activeEdge:edge.id, components:now
      });
    }
    push({
      phase:"finish", title:"基准算法完成",
      detail:`共找到 ${states.filter(x => x === "bridge").length} 条桥。`,
      line:6, activeEdge:-1, components:base
    });
    return events;
  }

  class DSU {
    constructor(n) { this.p=Array.from({length:n},(_,i)=>i); this.sz=Array(n).fill(1); }
    find(x) { while(x!==this.p[x]) { this.p[x]=this.p[this.p[x]]; x=this.p[x]; } return x; }
    unite(a,b) {
      a=this.find(a); b=this.find(b); if(a===b)return false;
      if(this.sz[a]<this.sz[b]) [a,b]=[b,a];
      this.p[b]=a; this.sz[a]+=this.sz[b]; return true;
    }
  }

  function buildStatic(sample) {
    const n=sample.nodes.length, states=Array(sample.edges.length).fill("neutral");
    const build=new DSU(n), tree=Array.from({length:n},()=>[]), extra=[], events=[];
    const parent=Array(n).fill(-1), depth=Array(n).fill(0), parentEdge=Array(n).fill(-1);
    const up=Array.from({length:n},(_,i)=>i);
    let work=0, components=n;
    const values=()=>parent.map((p,i)=>p<0?"":`p${p} · d${depth[i]} · ↑${up[i]}`);
    const push=data=>events.push({
      line:0,activeNode:-1,activeEdge:-1,bridges:states.filter(x=>x==="bridge").length,
      components,work,edgeState:clone(states),values:values(),...data
    });
    push({phase:"init",title:"初始化生成森林",detail:"所有树边先视为桥候选。",line:0});
    sample.edges.forEach(e=>{
      work++;
      if(e.u!==e.v&&build.unite(e.u,e.v)){
        states[e.id]="bridge"; components--;
        tree[e.u].push({to:e.v,edge:e.id}); tree[e.v].push({to:e.u,edge:e.id});
        push({phase:"tree",title:`e${e.id} 加入生成森林`,detail:"端点原本属于不同连通块，暂定为桥。",line:1,activeEdge:e.id});
      }else{
        states[e.id]="safe"; extra.push(e.id);
        push({phase:"extra",title:`e${e.id} 是非树边`,detail:"两端已连通，它与树路径构成一个环。",line:2,activeEdge:e.id});
      }
    });
    for(let root=0;root<n;root++){
      if(parent[root]!==-1)continue;
      parent[root]=root;
      const stack=[root];
      while(stack.length){
        const u=stack.pop();
        tree[u].forEach(({to,edge})=>{
          if(parent[to]!==-1)return;
          parent[to]=u; depth[to]=depth[u]+1; parentEdge[to]=edge; stack.push(to);
        });
      }
    }
    push({phase:"root",title:"建立 parent / depth / up",detail:"接下来可沿较深端点向上压缩。",line:3});
    const findUp=x=>{let r=x;while(up[r]!==r)r=up[r];while(up[x]!==x){const y=up[x];up[x]=r;x=y}return r};
    extra.forEach(id=>{
      const e=sample.edges[id]; let a=findUp(e.u),b=findUp(e.v);
      push({phase:"cycle",title:`处理非树边 e${id}`,detail:`从 ${e.u} 与 ${e.v} 两端向上，取消环上树边。`,line:4,activeEdge:id});
      while(a!==b){
        if(depth[a]<depth[b])[a,b]=[b,a];
        if(parent[a]===a)break;
        const eid=parentEdge[a]; work++;
        states[eid]="safe"; up[a]=findUp(parent[a]);
        push({phase:"compress",title:`取消 e${eid} 的桥标记`,detail:`顶点 ${a} 的 up 指针压缩到 ${up[a]}。`,line:8,activeNode:a,activeEdge:eid});
        a=findUp(a);
      }
    });
    push({phase:"finish",title:"保留的树边就是桥",detail:`共找到 ${states.filter(x=>x==="bridge").length} 条桥。`,line:9});
    return events;
  }

  function prefixBridgeStates(sample, end) {
    const states=Array(sample.edges.length).fill("neutral");
    const prefix={nodes:sample.nodes,edges:sample.edges.slice(0,end+1)};
    const base=componentCount(prefix);
    prefix.edges.forEach(e=>states[e.id]=componentCount(prefix,e.id)>base?"bridge":"safe");
    return states;
  }

  function buildOnline(sample) {
    const n=sample.nodes.length, events=[];
    const dsu2=Array.from({length:n},(_,i)=>i), dsuCC=Array.from({length:n},(_,i)=>i);
    const ccSize=Array(n).fill(1), parent=Array(n).fill(-1), last=Array(n).fill(0);
    let bridges=0,it=0,work=0,components=n;
    const find2=v=>v===-1?-1:(dsu2[v]===v?v:(dsu2[v]=find2(dsu2[v])));
    const findCC=v=>{v=find2(v);return dsuCC[v]===v?v:(dsuCC[v]=findCC(dsuCC[v]))};
    const values=()=>dsu2.map((_,i)=>`2e:${find2(i)} · p:${parent[i]}`);
    const push=(edgeState,data)=>events.push({line:0,activeNode:-1,activeEdge:-1,bridges,components,work,edgeState:clone(edgeState),values:values(),...data});
    const makeRoot=start=>{
      let v=find2(start),root=v,child=-1;
      while(v!==-1){const p=find2(parent[v]);parent[v]=child;dsuCC[v]=root;child=v;v=p}
      ccSize[root]=ccSize[child];
    };
    const mergePath=(startA,startB)=>{
      it++;let a=startA,b=startB,lca=-1;const pa=[],pb=[];
      while(lca===-1){
        if(a!==-1){a=find2(a);pa.push(a);if(last[a]===it){lca=a;break}last[a]=it;a=parent[a]}
        if(b!==-1){b=find2(b);pb.push(b);if(last[b]===it){lca=b;break}last[b]=it;b=parent[b]}
      }
      for(const path of [pa,pb]){
        for(const v of path){
          dsu2[v]=lca;
          if(v===lca)break;
          bridges--;work++;
        }
      }
      return lca;
    };
    push(Array(sample.edges.length).fill("neutral"),{phase:"init",title:"初始化两个并查集",detail:"每个顶点各自构成连通块和 2-边连通分量。",line:0});
    sample.edges.forEach(e=>{
      work++;let a=find2(e.u),b=find2(e.v),type,line,title,detail;
      if(a===b){type="inside";line=2;title=`e${e.id} 已在同一 2ECC`;detail="桥数量不变。"}
      else{
        let ca=findCC(a),cb=findCC(b);
        if(ca!==cb){
          type="connect";line=4;bridges++;components--;
          if(ccSize[ca]>ccSize[cb]){[a,b]=[b,a];[ca,cb]=[cb,ca]}
          makeRoot(a);parent[a]=b;dsuCC[a]=b;ccSize[cb]+=ccSize[a];
          title=`e${e.id} 连接两个连通块`;detail="新边当前是桥，bridges + 1。";
        }else{
          type="merge";line=7;const before=bridges,lca=mergePath(a,b);
          title=`e${e.id} 闭合一个环`;detail=`在 LCA ${lca} 汇合，${before-bridges} 条旧桥失效。`;
        }
      }
      push(prefixBridgeStates(sample,e.id),{phase:type,title,detail,line,activeEdge:e.id});
    });
    push(prefixBridgeStates(sample,sample.edges.length-1),{phase:"finish",title:"在线处理完成",detail:`最终桥数量为 ${bridges}。`,line:9});
    return events;
  }

  function build(sample) {
    const traces = {brute:buildBrute(sample), static:buildStatic(sample), online:buildOnline(sample)};
    const summary = {};
    Object.keys(traces).forEach(id => {
      const last = traces[id][traces[id].length - 1];
      summary[id] = {steps:traces[id].length, work:last.work, bridges:last.bridges};
    });
    return {traces, summary};
  }

  return {algorithms, cases, build};
})();

#include<bits/stdc++.h>
#define int long long
using namespace std;
const int N=2e5+7;
vector<pair<int,int> > g[N];
int dfn[N],low[N],f[N];
int tim;
int bianhao;
stack<int> stk;

void tarjan(int fa,int u)
{
	low[u]=dfn[u]=++tim;
	for(auto it:g[u])
	{
		int v=it.first;
		if(v==fa)continue;
		
		
		if(!dfn[v])
		{
			stk.push(it.second);
			tarjan(u,v);
			low[u]=min(low[u],low[v]);
		
			if(low[v]>=dfn[u])
			{
				while(1)
				{
					int i=stk.top();
					stk.pop();
					f[i]=bianhao;
					if(i==it.second)break;
				}
				bianhao++; 
			}	
		}
		else if(dfn[v]<dfn[u])
		{
			stk.push(it.second);
			low[u]=min(low[u],dfn[v]);
		} 
	}
}

void solve()
{
	int n,m;
	cin>>n>>m;
	tim=0;
	bianhao=0;
	while(!stk.empty())stk.pop();
	for(int i=0;i<=n;i++)
	{
		g[i].clear();
		dfn[i]=low[i]=f[i]=0; 
		bianhao=1;
	}
	for(int i=1;i<=m;i++)
	{
		int u,v;
		cin>>u>>v;
		g[u].push_back({v,i});
		g[v].push_back({u,i});
	}
	for(int i=1;i<=n;i++)
	{
		if(dfn[i]==0)tarjan(0,i);
	}
	for(int i=1;i<=n;i++)
	{
		int ans=0;
		map<int,int> mp;
		for(auto it:g[i])
		{
			mp[f[it.second]]++;
		}
		for(auto it:mp)
		{
			ans+=it.second/2; 
		}
		cout<<ans<<" \n"[i==n];
	}
}

signed main()
{
	ios::sync_with_stdio(false);
	cin.tie(0);
	int T;
	cin>>T;
	while(T--)
	{
		solve();
	}
	
}

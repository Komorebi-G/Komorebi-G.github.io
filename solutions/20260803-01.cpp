#include <bits/stdc++.h>
using namespace std;
#define int long long
const int N=5e5+7;
vector<int> g[N];
int w[N];
int a[N];
int fa[N];
int sz[N];
int isv[N];

int find(int x)
{
	if(fa[x]==x)return x;
	fa[x]=find(fa[x]);
	return fa[x];
}

void merge(int i,int j)
{
	int ii=find(i);
	int jj=find(j);
	if(ii==jj)return;
	if(sz[ii]>sz[jj])
	{
		fa[jj]=ii;
		sz[ii]+=sz[jj];
	}
	else
	{
		fa[ii]=jj;
		sz[jj]+=sz[ii];
	}
}

struct query
{
	int u,x;
	int i;
	int ans;
};
query qr[N];

signed main()
{
	ios::sync_with_stdio(false);
	cin.tie(0);
	cout.tie(0);
	
	int n,m;
	cin>>n>>m;
	for(int i=1;i<=n;i++)cin>>w[i];
	for(int i=1;i<=n;i++)
	{
		a[i]=i;
		fa[i]=i;
		sz[i]=1;
	}
	sort(a+1,a+1+n,[](const int&l,const int &r)
	{
		return w[l]<w[r];
	});
	//for(int i=1;i<=n;i++)cout<<a[i]<<endl;
	
	while(m--)
	{
		int u,v;
		cin>>u>>v;
		g[u].push_back(v);
		g[v].push_back(u);
	}
	int q;
	cin>>q;
	for(int i=1;i<=q;i++)
	{
		qr[i].i=i;
		cin>>qr[i].u>>qr[i].x;
	}
	sort(qr+1,qr+1+q,[](const query&l,const query&r)
	{
		return l.x<r.x;
	});
	
	//for(int i=1;i<=q;i++)cout<<qr[i].u<<' '<<qr[i].x<<endl;
	
	int p=1;
	for(int i=1;i<=q;i++)
	{
		while(p<=n&&w[a[p]]<=qr[i].x)
		{
			int u=a[p];
			for(int v:g[u])
			{
				if(isv[v])
				{
					merge(v,u);
				}
			}
			isv[u]=1;
			//cout<<"p:"<<p<<' '<<u<<endl;
			p++;
		}
		//cout<<"find"<<find(qr[i].u)<<endl;
		//for(int i=1;i<=n;i++)cout<<fa[i]<<" \n"[i==n];
		//cout<<"qr"<<qr[i].x<<endl;
		qr[i].ans=sz[find(qr[i].u)];
	}
	sort(qr+1,qr+1+q,[](const query&l,const query&r)
	{
		return l.i<r.i;
	});
	for(int i=1;i<=q;i++)cout<<qr[i].ans<<'\n';
}

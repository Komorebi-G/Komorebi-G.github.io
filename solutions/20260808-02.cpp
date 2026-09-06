#include <bits/stdc++.h>
using namespace std;
#define int long long
#define double long double
const int N=2e5+7;
int a[N],b[N];
int isv[N];
vector<int> ans;
int mpa[N];
int mpb[N];
int n,x;

int check()
{
	priority_queue<int,vector<int> > qa;
	priority_queue<int,vector<int> > qb;
	for(int i=1;i<n;i++)
	{
		qa.push(a[i]);
		qb.push(b[i]);
		while(!qa.empty()&&qa.top()==qb.top())
		{
			//cout<<qa.top()<<' '<<qb.top()<<endl;
			qa.pop();
			qb.pop();
		}
		if(qa.empty())return false;
	}
	//cout<<"??";
	for(int i=1;i<=n;i++)
	{
		if(a[i]==x)
		{
			i++;
			while(i<=n)isv[a[i++]]=1;
		}
	}
	for(int i=1;i<=n;i++)
	{
		if(b[i]==x)
		{
			i++;
			while(i<=n)
			{
				if(isv[b[i++]]==1)return false;
			}
		}
	}
	return true;
}

signed main()
{
	cin>>n>>x;
	for(int i=1;i<=n;i++)
	{
		cin>>a[i];
		mpb[a[i]]=i;
	}
	for(int i=1;i<=n;i++)
	{
		cin>>b[i];
		mpa[b[i]]=i;
	}
	if(!check())
	{
		cout<<"NO";
		return 0;
	}
	for(int i=1;i<=n;i++)isv[i]=0;
	int pa=1,pb=1;
	while(a[pa]!=x||b[pb]!=x)
	{
		if(a[pa]==x)
		{
			ans.push_back(b[pb]);
			isv[b[pb]]=1;
		}
		else if(b[pb]==x)
		{
			ans.push_back(a[pa]);
			isv[a[pa]]=1;
		}
		else
		{
			if(mpa[a[pa]]<mpb[b[pb]])
			{
				ans.push_back(a[pa]);
				isv[a[pa]]=1;
			}
			else 
			{
				ans.push_back(b[pb]);
				isv[b[pb]]=1;
			}
		}
		while(pa<=n&&isv[a[pa]])pa++;
		while(pb<=n&&isv[b[pb]])pb++;
	}
	int sz=ans.size();
	cout<<"YES\n";
	for(int i=0;i<sz;i++)
	{
		if(i)cout<<' ';
		cout<<ans[i];	
	}
}

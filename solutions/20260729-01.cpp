#include <bits/stdc++.h>
using namespace std;
#define int long long
const int N=5e5+7;
int a[N];


//string gets(vector<int>&v)
//{
//	string ans;
//	int flag=0;
//	for(int i:v)
//	{
//		if(i==1)flag=1;
//		if(flag)ans=ans+char(i+'0');
//	}
//	for(int i:v)
//	{
//		if(i==1)break;
//		ans=ans+char(i+'0');
//	}
//	return ans;
//}
//
//bool isv(vector<int>&v,int i)
//{
//	for(int j:v)if(i==j)return true;
//	return false;
//}
//
//string solve(int k,vector<int>&v,int n)
//{
//	if(k>n)return gets(v);
//	string ans;
//	int fir=1;
//	if(k%2)
//	{
//		for(int i=1;i<=n;i++)
//		{
//			if(isv(v,i))continue;
//			v.push_back(i);
//			if(fir)
//			{
//				fir=0;
//				ans=solve(k+1,v,n);
//			}
//			else
//			{
//				string tmp=solve(k+1,v,n);
//				if(ans>tmp)ans=tmp;
//			}
//			v.pop_back();
//		}
//	}
//	else
//	{
//		for(int i=1;i<=n;i++)
//		{
//			if(isv(v,i))continue;
//			v.push_back(i);
//			if(fir)
//			{
//				fir=0;
//				ans=solve(k+1,v,n);
//			}
//			else
//			{
//				string tmp=solve(k+1,v,n);
//				if(ans<tmp)ans=tmp;
//			}
//			v.pop_back();
//		}
//	}
//	return ans;
//}
//
//
//void out(string s)
//{
//	for(char c:s)cout<<c-'0'<<' ';
//	cout<<endl;
//}

signed main()
{
//	for(int i=2;i<=11;i+=2)
//	{
//		vector<int> v;
//		out(solve(1,v,i));
//	}
	int t;
	cin>>t;
	while(t--)
	{
		int n;
		cin>>n;
		if(n%2)
		{
			a[1]=1;
			a[3]=2;
			int st1=n,st2=3;
			for(int i=n;i>=2;i--)
			{
				if(i==3)continue;
				if(i%2)a[i]=st1--;
				else a[i]=st2++;
			}
			for(int i=1;i<=n;i++)cout<<a[i]<<" \n"[i==n];
		}
		else
		{
			a[1]=1;
			int st1=n,st2=2;
			for(int i=n;i>=2;i--)
			{
				if(i%2==0)a[i]=st1--;
				else a[i]=st2++;
			}
			for(int i=1;i<=n;i++)cout<<a[i]<<" \n"[i==n];
		}
	}
}

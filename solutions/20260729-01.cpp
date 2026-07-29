#include <bits/stdc++.h>
using namespace std;
#define int long long

signed main()
{
	int n;
	cin>>n;
	while(n--)
	{
		int t;
		cin>>t;
		if(t%2)
		{
			int st1=1,st2=(t+1)/2+1;
			for(int i=1;i<=t;i++)
			{
				if(i%2)cout<<st1++<<" \n"[i==t];
				else cout<<st2++<<" \n"[i==t];
			} 
		}
		else
		{
			int st1=1,st2=t/2+1;
			for(int i=1;i<=t;i++)
			{
				if(i%2)cout<<st1++<<" \n"[i==t];
				else cout<<st2++<<" \n"[i==t];
			} 
		}
	}
}

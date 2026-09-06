import * as React from "react";
import { useLocation } from "wouter";
import { TopBar } from "./TopBar";
import MobileHeader from "./MobileHeader";
import MobileFloatingTopMenu from "../MobileFloatingTopMenu";
import { EmailVerificationBanner } from "../EmailVerificationBanner";
import { KenyaFieldTestBadge } from "../KenyaFieldTestBadge";
export default function AppLayout({title,actions,children,pageChrome,hideNavOnMobile=false}:{title:string;actions?:any;children:React.ReactNode;pageChrome?:React.ReactNode;hideNavOnMobile?:boolean}) {
 const [path]=useLocation();
 return <div className="nn-app min-h-dvh bg-background text-foreground" data-page={path.split('/').pop()||'dashboard'}>
 <MobileHeader title={title}/><TopBar title={title} actions={actions} className="max-xl:hidden"/>
 <div className="nn-layout-notices"><EmailVerificationBanner variant="banner"/><KenyaFieldTestBadge/></div>
 {pageChrome?<div className="nn-page-chrome">{pageChrome}</div>:<main className={"nn-main "+(hideNavOnMobile?"nn-main-full":"")}>{children}</main>}
 <MobileFloatingTopMenu/>
 </div>;
}

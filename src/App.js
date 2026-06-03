import { useState, useEffect, useRef } from "react";

// ── Storage ──────────────────────────────────────────────────────
const S = {
  get: (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Constants ────────────────────────────────────────────────────
const ADMIN = { email: "admin@traintrack.com", password: "Admin@123" };
const FIXED_TOPICS = ["Product Knowledge","Test Drive Process","CRM & Software","Customer Handling","Objection Handling","Finance & Insurance","Delivery Process","Competitor Analysis","Showroom Etiquette","Follow-Up Skills"];
const ACTIVITY_TYPES = ["Customer Visit","Showroom Visit","Field Visit","Senior Coordination","Self Learning","Other"];
const ATT_OPTIONS = ["Present","Absent","Leave"];
const RATINGS = [1,2,3,4,5];
const ENGAGING_ASPECTS = ["Role-play / Demos","Case Studies","Group Discussion","Digital / Video Content","Q&A with Trainer","Assessments / Quizzes"];
const FEEDBACK_CRITERIA = [
  { key:"sessionRate", label:"Rate the training session",         sub:"Overall training quality" },
  { key:"clarity",    label:"Trainer's clarity of explanation",   sub:"How clearly topics were explained" },
  { key:"relevance",  label:"Relevance to your daily sales work", sub:"How applicable it was" },
  { key:"materials",  label:"Training materials & resources",     sub:"Quality of materials provided" },
];


const EXIT_TYPES = ["Resignation","Termination","Absconding"];
const NOTICE_OPTIONS = ["Yes","No","Partial"];
const RESIGN_CHANNELS = ["Email","Verbal","WhatsApp","HRMS"];
const EXIT_REASONS = [
  "Salary Issue","Career Growth","Manager Behavior","Work Pressure","Personal Reason",
  "Health Issue","Relocation","Better Opportunity","Shift Timing","Work Culture",
  "Job Role Mismatch","Performance Pressure","Family Issue","Higher Education",
  "Transportation Issue","Unsafe Environment","Policy Dissatisfaction"
];
// ── Utils ────────────────────────────────────────────────────────
const today     = () => new Date().toISOString().slice(0,10);
const yesterday = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
const fmt       = (d) => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const uid       = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const isValidDate = (d) => d===today()||d===yesterday();
const downloadCSV = (filename,rows) => {
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
};

// ── UI Atoms ─────────────────────────────────────────────────────
const Card     = ({children,className=""}) => <div className={`card ${className}`}>{children}</div>;
const Btn      = ({children,onClick,variant="primary",small,disabled,fullWidth}) => (
  <button onClick={onClick} disabled={disabled}
    className={`btn btn-${variant}${small?" btn-sm":""}${fullWidth?" btn-full":""}`}>{children}</button>
);
const Input    = ({label,...p}) => <div className="field">{label&&<label>{label}</label>}<input {...p}/></div>;
const Textarea = ({label,...p}) => <div className="field">{label&&<label>{label}</label>}<textarea {...p}/></div>;
const Sel      = ({label,options,...p}) => (
  <div className="field">{label&&<label>{label}</label>}
    <select {...p}>
      <option value="">— Select —</option>
      {options.map(o=>typeof o==="string"
        ?<option key={o} value={o}>{o}</option>
        :<option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Badge    = ({text,color="blue"}) => <span className={`badge badge-${color}`}>{text}</span>;
const StarRating = ({value,onChange,readOnly,size="md"}) => (
  <div className="stars">
    {RATINGS.map(r=>(
      <span key={r} className={`star star-${size}${value>=r?" filled":""}${readOnly?"":" clickable"}`}
        onClick={()=>!readOnly&&onChange(r)}>★</span>
    ))}
  </div>
);
const Modal = ({title,children,onClose}) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-box" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><span>{title}</span>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════
export default function App() {
  const [session,setSession]=useState(null);
  const [db,setDb]=useState({
    trainers:[],trainees:[],plans:[],attendance:[],
    feedbacks:[],activities:[],customTopics:[],
    masters:{channels:[],locations:[],training:[],tasks:[],divisions:[],activityTypes:[]},
  });

  useEffect(()=>{
    const saved=S.get("tt_db");
    if(saved) setDb(prev=>({...prev,...saved,
      masters:{channels:[],locations:[],training:[],tasks:[],divisions:[],activityTypes:[],...(saved.masters||{})}}));
    const sess=S.get("tt_session"); if(sess) setSession(sess);
  },[]);

  const saveDb  = (n) => { setDb(n); S.set("tt_db",n); };
  const patch   = (key,val) => saveDb({...db,[key]:val});
  const patchM  = (key,val) => saveDb({...db,masters:{...db.masters,[key]:val}});
  const logout  = () => { setSession(null); S.set("tt_session",null); };

  if(!session) return <LoginScreen db={db} onLogin={s=>{setSession(s);S.set("tt_session",s);}}/>;
  return <AppShell session={session} db={db} patch={patch} patchM={patchM} saveDb={saveDb} logout={logout}/>;
}

// ── Login ────────────────────────────────────────────────────────
function LoginScreen({db,onLogin}){
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [show,setShow]=useState(false); const [err,setErr]=useState("");
  const login=()=>{
    setErr("");
    if(!email||!pw){setErr("Enter email and password");return;}
    if(email.trim().toLowerCase()===ADMIN.email&&pw===ADMIN.password){
      onLogin({role:"admin",user:{name:"Admin",email:ADMIN.email}});return;
    }
    // allow login if active trainer
    const trainer=(db.trainers||[]).find(t=>
      t.email.toLowerCase()===email.trim().toLowerCase()&&t.password===pw&&t.active);
    if(trainer){onLogin({role:"trainer",user:trainer});return;}
    // allow login if active trainee
    const trainee=(db.trainees||[]).find(t=>
      t.email?.toLowerCase()===email.trim().toLowerCase()&&t.password===pw&&t.active!==false&&!t.leftDate);
    if(trainee){onLogin({role:"trainee",user:trainee});return;}
    setErr("Invalid credentials or account inactive");
  };
  return(
    <div className="login-wrap"><style>{CSS}</style>
      <div className="login-card">
        <div className="login-logo">◈</div>
        <h1 className="login-title">TrainTrack</h1>
        <p className="login-sub">Automobile Sales Training Portal</p>
        <div className="login-form">
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/>
          <div className="field pw-field"><label>Password</label>
            <div className="pw-wrap">
              <input type={show?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)}
                placeholder="Enter password" onKeyDown={e=>e.key==="Enter"&&login()}/>
              <button className="pw-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
            </div>
          </div>
          {err&&<p className="err-msg">{err}</p>}
          <Btn onClick={login} fullWidth>Login</Btn>
          <p className="login-hint">Contact your administrator for login credentials</p>
        </div>
      </div>
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────
function AppShell({session,db,patch,patchM,saveDb,logout}){
  const {role,user}=session;
  const [tab,setTab]=useState("dashboard");

  const navItems={
    admin:[
      {id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"trainers",icon:"🎓",label:"Trainers"},
      {id:"trainees",icon:"👥",label:"Trainees"},{id:"masters",icon:"🗂",label:"Masters"},
      {id:"activity",icon:"🏃",label:"Activities"},{id:"reports",icon:"📊",label:"Reports"},
    ],
    trainer:[
      {id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"trainees",icon:"👥",label:"Trainees"},
      {id:"plans",icon:"📋",label:"Plans"},{id:"attendance",icon:"✅",label:"Attendance"},
      {id:"activity",icon:"🏃",label:"Activities"},{id:"reports",icon:"📊",label:"Reports"},
    ],
    trainee:[
      {id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"myplan",icon:"📋",label:"My Plan"},
      {id:"attendance",icon:"✅",label:"Attendance"},{id:"feedback",icon:"💬",label:"Feedback"},
      {id:"activity",icon:"🏃",label:"Activities"},
    ],
  }[role];

  const allTopics=(db.masters?.training||[]).length>0
    ?(db.masters.training):[...FIXED_TOPICS,...(db.customTopics||[])];
  const activityTypes=(db.masters?.activityTypes||[]).length>0
    ?(db.masters.activityTypes):ACTIVITY_TYPES;

  return(
    <div className="app"><style>{CSS}</style>
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">◈</div>
          <div><div className="app-title">TrainTrack</div><div className="app-sub">Automobile Sales Training</div></div>
        </div>
        <div className="header-right">
          <div className="user-chip">
            <span className="user-role-dot" data-role={role}></span>
            <span>{user?.name||user?.email}</span>
          </div>
          <button className="logout-btn" onClick={logout}>⏻</button>
        </div>
      </header>

      <main className="main">
        {role==="admin"&&tab==="dashboard"  &&<AdminDashboard db={db}/>}
        {role==="admin"&&tab==="trainers"   &&<TrainersPanel db={db} patch={patch}/>}
        {role==="admin"&&tab==="trainees"   &&<AdminTraineesView db={db} patch={patch}/>}
        {role==="admin"&&tab==="masters"    &&<MastersPanel db={db} patchM={patchM}/>}
        {role==="admin"&&tab==="activity"   &&<StaffActivityPanel role={role} user={user} db={db} patch={patch} activityTypes={activityTypes}/>}
        {role==="admin"&&tab==="reports"    &&<ReportsPanel db={db}/>}

        {role==="trainer"&&tab==="dashboard" &&<TrainerDashboard user={user} db={db}/>}
        {role==="trainer"&&tab==="trainees"  &&<TraineesPanel user={user} db={db} patch={patch}/>}
        {role==="trainer"&&tab==="plans"     &&<TrainingPlanPanel user={user} db={db} patch={patch} allTopics={allTopics}/>}
        {role==="trainer"&&tab==="attendance"&&<AttendanceViewPanel user={user} db={db}/>}
        {role==="trainer"&&tab==="activity"  &&<StaffActivityPanel role={role} user={user} db={db} patch={patch} activityTypes={activityTypes}/>}
        {role==="trainer"&&tab==="reports"   &&<TrainerReports user={user} db={db}/>}

        {role==="trainee"&&tab==="dashboard" &&<JoinerDashboard user={user} db={db}/>}
        {role==="trainee"&&tab==="myplan"    &&<MyPlanPanel user={user} db={db} patch={patch}/>}
        {role==="trainee"&&tab==="attendance"&&<TraineeAttendance user={user} db={db} patch={patch}/>}
        {role==="trainee"&&tab==="feedback"  &&<FeedbackPanel user={user} db={db} patch={patch} allTopics={allTopics}/>}
        {role==="trainee"&&tab==="activity"  &&<TraineeActivityPanel user={user} db={db} patch={patch} activityTypes={activityTypes}/>}
      </main>

      <nav className="bottom-nav">
        {navItems.map(n=>(
          <button key={n.id} className={`nav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
            <span className="nav-icon">{n.icon}</span><span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Masters Panel ────────────────────────────────────────────────
function MastersPanel({db,patchM}){
  const masters=db.masters||{};
  const [activeTab,setActiveTab]=useState("channels");
  const [input,setInput]=useState(""); const [err,setErr]=useState("");
  const cfg={
    channels:    {label:"Channel Master",       icon:"🏢",desc:"Arena, Nexa, Commercial, Truevalue",    placeholder:"e.g. Arena"},
    locations:   {label:"Location Master",      icon:"📍",desc:"Branch or showroom locations",          placeholder:"e.g. Pune"},
    divisions:   {label:"Division Master",      icon:"🏗",desc:"Company divisions or departments",      placeholder:"e.g. Sales"},
    training:    {label:"Training Master",      icon:"📚",desc:"Training topics for plans & feedback",  placeholder:"e.g. Product Knowledge"},
    tasks:       {label:"Task Master",          icon:"✅",desc:"Task types trainer assigns to trainees",placeholder:"e.g. PDI Check"},
    activityTypes:{label:"Activity Type Master",icon:"🏃",desc:"Activity types for daily activity log", placeholder:"e.g. Customer Visit"},
  };
  const list=masters[activeTab]||[];
  const c=cfg[activeTab];
  const add=()=>{
    setErr(""); const v=input.trim();
    if(!v){setErr("Enter a value");return;}
    if(list.map(i=>i.toLowerCase()).includes(v.toLowerCase())){setErr("Already exists");return;}
    patchM(activeTab,[...list,v]); setInput("");
  };
  const remove=(item)=>patchM(activeTab,list.filter(i=>i!==item));
  const move=(idx,dir)=>{
    const a=[...list]; const s=idx+dir;
    if(s<0||s>=a.length)return;
    [a[idx],a[s]]=[a[s],a[idx]]; patchM(activeTab,a);
  };
  return(
    <div className="section">
      <h2 className="section-title">Masters</h2>
      <p className="section-date" style={{marginBottom:16}}>Manage dropdown values used across the app</p>
      <div className="master-tabs">
        {Object.entries(cfg).map(([key,val])=>(
          <button key={key} className={`master-tab${activeTab===key?" active":""}`}
            onClick={()=>{setActiveTab(key);setInput("");setErr("");}}>
            <span>{val.icon}</span><span>{val.label}</span>
            <span className="master-tab-count">{(masters[key]||[]).length}</span>
          </button>
        ))}
      </div>
      <Card className="form-card">
        <div className="master-head">
          <span className="master-icon">{c.icon}</span>
          <div><div className="master-title">{c.label}</div><div className="master-desc">{c.desc}</div></div>
        </div>
        <div className="inline-add" style={{marginTop:14}}>
          <input value={input} onChange={e=>{setInput(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&add()} placeholder={c.placeholder} className="inline-input"/>
          <button className="inline-btn" onClick={add}>+ Add</button>
        </div>
        {err&&<p className="err-msg">{err}</p>}
      </Card>
      {list.length===0?<p className="empty">No items yet.</p>:list.map((item,idx)=>(
        <Card key={item} className="master-item-row">
          <div className="master-item-left">
            <div className="master-order-btns">
              <button className="order-btn" onClick={()=>move(idx,-1)} disabled={idx===0}>▲</button>
              <button className="order-btn" onClick={()=>move(idx,1)} disabled={idx===list.length-1}>▼</button>
            </div>
            <span className="master-item-num">{idx+1}</span>
            <span className="master-item-name">{item}</span>
          </div>
          <button className="del-btn" onClick={()=>remove(item)}>✕</button>
        </Card>
      ))}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────────
function AdminDashboard({db}){
  const trainers=db.trainers||[]; const trainees=db.trainees||[];
  const active=trainees.filter(t=>!t.leftDate&&t.active!==false);
  const present=(db.attendance||[]).filter(a=>a.date===today()&&a.status==="Present").length;
  return(
    <div className="section">
      <h2 className="section-title">Admin Dashboard</h2><p className="section-date">{fmt(today())}</p>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num accent">{trainers.filter(t=>t.active).length}</div><div className="stat-lbl">Active Trainers</div></div>
        <div className="stat-card"><div className="stat-num">{active.length}</div><div className="stat-lbl">Active Trainees</div></div>
        <div className="stat-card"><div className="stat-num accent">{present}</div><div className="stat-lbl">Present Today</div></div>
        <div className="stat-card"><div className="stat-num red">{trainees.filter(t=>t.leftDate).length}</div><div className="stat-lbl">Left</div></div>
      </div>
      <h3 className="sub-title">Trainer Overview</h3>
      {trainers.map(tr=>{
        const mine=trainees.filter(t=>t.trainerId===tr.id);
        return(
          <Card key={tr.id}>
            <div className="to-head">
              <div className="trainee-avatar">{tr.name[0]}</div>
              <div><div className="trainee-name">{tr.name}</div><div className="trainee-meta">{tr.email}</div></div>
              <Badge text={tr.active?"Active":"Inactive"} color={tr.active?"green":"red"}/>
            </div>
            <div className="to-stats">
              <span>👥 {mine.filter(t=>!t.leftDate&&t.active!==false).length} active</span>
              {mine.filter(t=>t.leftDate).length>0&&<span className="red-text">🚪 {mine.filter(t=>t.leftDate).length} left</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Trainers Panel (Admin) ───────────────────────────────────────
function TrainersPanel({db,patch}){
  const trainers=db.trainers||[];
  const masters=db.masters||{};
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",email:"",password:"",mobile:"",channel:"",location:"",division:""});
  const [err,setErr]=useState("");
  const [editPw,setEditPw]=useState(null); const [newPw,setNewPw]=useState("");

  const add=()=>{
    setErr("");
    if(!form.name||!form.email||!form.password){setErr("Name, email, password required");return;}
    // allow same email if all previous with that email are inactive
    const existing=trainers.filter(t=>t.email.toLowerCase()===form.email.toLowerCase());
    if(existing.some(t=>t.active)){setErr("Email already used by an active trainer");return;}
    patch("trainers",[...trainers,{...form,id:uid(),active:true,createdAt:today()}]);
    setForm({name:"",email:"",password:"",mobile:"",channel:"",location:"",division:""}); setAdding(false);
  };
  const toggle=(id)=>patch("trainers",trainers.map(t=>t.id===id?{...t,active:!t.active}:t));
  const resetPw=(id)=>{
    if(!newPw.trim())return;
    patch("trainers",trainers.map(t=>t.id===id?{...t,password:newPw}:t));
    setEditPw(null);setNewPw("");
  };

  return(
    <div className="section">
      <div className="section-header"><h2 className="section-title">Trainers</h2><Btn small onClick={()=>setAdding(!adding)}>{adding?"Cancel":"+ Add"}</Btn></div>
      {adding&&(
        <Card className="form-card">
          <Input label="Full Name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Trainer name"/>
          <Input label="Email *" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="trainer@company.com"/>
          <Input label="Password *" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Set password"/>
          <Input label="Mobile" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="Mobile"/>
          {(masters.channels||[]).length>0&&<Sel label="Channel" options={masters.channels} value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}/>}
          {(masters.locations||[]).length>0&&<Sel label="Location" options={masters.locations} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>}
          {(masters.divisions||[]).length>0&&<Sel label="Division" options={masters.divisions} value={form.division} onChange={e=>setForm({...form,division:e.target.value})}/>}
          {err&&<p className="err-msg">{err}</p>}
          <Btn onClick={add}>Create Trainer Login</Btn>
        </Card>
      )}
      {trainers.map(t=>(
        <Card key={t.id}>
          <div className="trainee-row">
            <div className="trainee-info">
              <div className={`trainee-avatar${!t.active?" left":""}`}>{t.name[0]}</div>
              <div>
                <div className="trainee-name">{t.name}</div>
                <div className="trainee-meta">{t.email}</div>
                {[t.channel,t.location,t.division].filter(Boolean).length>0&&
                  <div className="trainee-meta">{[t.channel,t.location,t.division].filter(Boolean).join(" · ")}</div>}
              </div>
            </div>
            <Badge text={t.active?"Active":"Inactive"} color={t.active?"green":"red"}/>
          </div>
          <div className="action-row">
            <Btn small variant="secondary" onClick={()=>toggle(t.id)}>{t.active?"Deactivate":"Activate"}</Btn>
            <Btn small variant="secondary" onClick={()=>{setEditPw(t.id);setNewPw("");}}>Reset PW</Btn>
          </div>
          {editPw===t.id&&(
            <div className="inline-add" style={{marginTop:8}}>
              <input value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password…" className="inline-input"/>
              <button className="inline-btn" onClick={()=>resetPw(t.id)}>Save</button>
              <button className="inline-btn" style={{color:"var(--text2)"}} onClick={()=>setEditPw(null)}>✕</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Admin Trainees View ──────────────────────────────────────────
function AdminTraineesView({db,patch}){
  const trainees=db.trainees||[]; const trainers=db.trainers||[];
  const masters=db.masters||{};
  const [filter,setFilter]=useState("active");
  const [editModal,setEditModal]=useState(null); const [editForm,setEditForm]=useState({});
  const [pwModal,setPwModal]=useState(null); const [newPw,setNewPw]=useState("");

  const filtered=trainees.filter(t=>{
    if(filter==="active") return !t.leftDate&&t.active!==false;
    if(filter==="inactive") return t.active===false&&!t.leftDate;
    if(filter==="left") return !!t.leftDate;
    return true;
  });

  const openEdit=(t)=>{
    setEditForm({channel:t.channel||"",location:t.location||"",division:t.division||""});
    setEditModal(t.id);
  };
  const saveEdit=()=>{
    patch("trainees",trainees.map(t=>t.id===editModal?{...t,...editForm}:t));
    setEditModal(null);
  };
  const toggleActive=(id)=>patch("trainees",trainees.map(t=>t.id===id?{...t,active:t.active===false}:t));
  const resetPw=(id)=>{
    if(!newPw.trim())return;
    patch("trainees",trainees.map(t=>t.id===id?{...t,password:newPw}:t));
    setPwModal(null);setNewPw("");
  };

  const counts={
    all:trainees.length,
    active:trainees.filter(t=>!t.leftDate&&t.active!==false).length,
    inactive:trainees.filter(t=>t.active===false&&!t.leftDate).length,
    left:trainees.filter(t=>t.leftDate).length,
  };

  return(
    <div className="section">
      <h2 className="section-title">All Trainees</h2>
      <div className="filter-tabs">
        {[["all","All"],["active","Active"],["inactive","Inactive"],["left","Left"]].map(([k,l])=>(
          <button key={k} className={`filter-tab${filter===k?" active":""}`} onClick={()=>setFilter(k)}>
            {l} ({counts[k]})
          </button>
        ))}
      </div>
      {filtered.map(t=>{
        const trainer=trainers.find(tr=>tr.id===t.trainerId);
        const present=(db.attendance||[]).filter(a=>a.traineeId===t.id&&a.status==="Present").length;
        const isActive=t.active!==false&&!t.leftDate;
        return(
          <Card key={t.id}>
            <div className="trainee-row">
              <div className="trainee-info">
                <div className={`trainee-avatar${!isActive?" left":""}`}>{t.name[0]}</div>
                <div>
                  <div className="trainee-name">{t.name}
                    {t.leftDate&&<span className="left-tag">Left</span>}
                    {t.active===false&&!t.leftDate&&<span className="left-tag" style={{background:"var(--text2)"}}>Inactive</span>}
                  </div>
                  <div className="trainee-meta">{t.email}</div>
                  <div className="trainee-meta">{t.empId} · Joined {fmt(t.joiningDate)}</div>
                  {[t.channel,t.location,t.division].filter(Boolean).length>0&&
                    <div className="trainee-meta">🏢 {[t.channel,t.location,t.division].filter(Boolean).join(" · ")}</div>}
                  {t.leftDate&&<div className="trainee-meta red-text">Left: {fmt(t.leftDate)}</div>}
                  <div className="trainee-meta">Trainer: {trainer?.name||"—"}</div>
                </div>
              </div>
            </div>
            <div className="to-stats"><span>✅ {present} present</span><span>📋 {(db.plans||[]).filter(p=>p.traineeId===t.id).length} plans</span></div>
            <div className="action-row">
              <Btn small variant="secondary" onClick={()=>openEdit(t)}>Edit</Btn>
              {!t.leftDate&&<Btn small variant="secondary" onClick={()=>toggleActive(t.id)}>{t.active===false?"Activate":"Deactivate"}</Btn>}
              <Btn small variant="secondary" onClick={()=>{setPwModal(t.id);setNewPw("");}}>Reset PW</Btn>
            </div>
            {pwModal===t.id&&(
              <div className="inline-add" style={{marginTop:8}}>
                <input value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password…" className="inline-input"/>
                <button className="inline-btn" onClick={()=>resetPw(t.id)}>Save</button>
                <button className="inline-btn" style={{color:"var(--text2)"}} onClick={()=>setPwModal(null)}>✕</button>
              </div>
            )}
          </Card>
        );
      })}
      {editModal&&(
        <Modal title="Edit Trainee Details" onClose={()=>setEditModal(null)}>
          {(masters.channels||[]).length>0&&<Sel label="Channel" options={masters.channels} value={editForm.channel} onChange={e=>setEditForm({...editForm,channel:e.target.value})}/>}
          {(masters.locations||[]).length>0&&<Sel label="Location" options={masters.locations} value={editForm.location} onChange={e=>setEditForm({...editForm,location:e.target.value})}/>}
          {(masters.divisions||[]).length>0&&<Sel label="Division" options={masters.divisions} value={editForm.division} onChange={e=>setEditForm({...editForm,division:e.target.value})}/>}
          <Btn onClick={saveEdit} fullWidth>Save Changes</Btn>
        </Modal>
      )}
    </div>
  );
}

// ── Reports Panel (Admin) ────────────────────────────────────────
function ReportsPanel({db}){
  const trainees=db.trainees||[]; const trainers=db.trainers||[];
  const masters=db.masters||{};
  const [fromDate,setFromDate]=useState(today()); const [toDate,setToDate]=useState(today());
  const [filterLoc,setFilterLoc]=useState(""); const [filterDiv,setFilterDiv]=useState("");
  const [filterCh,setFilterCh]=useState(""); const [filterStatus,setFilterStatus]=useState("active");
  const [activeRep,setActiveRep]=useState("attendance");

  const filtered=trainees.filter(t=>{
    if(filterLoc&&t.location!==filterLoc)return false;
    if(filterDiv&&t.division!==filterDiv)return false;
    if(filterCh&&t.channel!==filterCh)return false;
    if(filterStatus==="active"&&(t.leftDate||t.active===false))return false;
    if(filterStatus==="inactive"&&t.active!==false)return false;
    if(filterStatus==="left"&&!t.leftDate)return false;
    return true;
  });

  const getDates=(from,to)=>{
    const dates=[]; let d=new Date(from);
    while(d<=new Date(to)){dates.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
    return dates;
  };

  const exportAttendance=()=>{
    const dates=getDates(fromDate,toDate);
    const header=["Name","Emp ID","Channel","Location","Division","Trainer",...dates,"Present","Absent","Leave"];
    const rows=filtered.map(t=>{
      const trainer=trainers.find(tr=>tr.id===t.trainerId);
      const daily=dates.map(d=>{
        const r=(db.attendance||[]).find(a=>a.traineeId===t.id&&a.date===d);
        return r?r.status:"";
      });
      return[t.name,t.empId,t.channel||"",t.location||"",t.division||"",trainer?.name||"",
        ...daily,
        daily.filter(s=>s==="Present").length,
        daily.filter(s=>s==="Absent").length,
        daily.filter(s=>s==="Leave").length];
    });
    downloadCSV(`Attendance_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportActivity=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Date","Type","Description","GPS Lat","GPS Lng","Timestamp","Logged By"];
    const rows=[];
    filtered.forEach(t=>{
      const acts=(db.activities||[]).filter(a=>a.traineeId===t.id&&a.date>=fromDate&&a.date<=toDate);
      if(!acts.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"","","","","","","",""]);
      else acts.forEach(a=>rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",
        a.date,a.type,a.description,a.lat||"",a.lng||"",a.timestamp||"",a.loggedBy||"trainee"]));
    });
    downloadCSV(`Activity_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportFeedback=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Date","Topic","Trainer Name","Session Rating","Clarity","Relevance","Materials","Engaging Aspects","Comments"];
    const rows=[];
    filtered.forEach(t=>{
      const fbs=(db.feedbacks||[]).filter(f=>f.traineeId===t.id&&f.date>=fromDate&&f.date<=toDate);
      if(!fbs.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"","","","","","","","","",""]);
      else fbs.forEach(f=>rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",
        f.date,f.topic||"",f.trainerName||"",f.sessionRate||"",f.clarity||"",f.relevance||"",f.materials||"",
        (f.aspects||[]).join("; "),f.comment||""]));
    });
    downloadCSV(`Feedback_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };


  const exportPlanStatus=()=>{
    const planStatuses=db.planStatuses||{};
    const header=["Name","Emp ID","Channel","Location","Division","Trainer","Plan Date","Topic","Status"];
    const rows=[];
    filtered.forEach(t=>{
      const trainer=trainers.find(tr=>tr.id===t.trainerId);
      const plans=(db.plans||[]).filter(p=>p.traineeId===t.id&&p.date>=fromDate&&p.date<=toDate);
      if(!plans.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",trainer?.name||"","","",""]);
      else plans.forEach(p=>p.topics.forEach(topic=>{
        const key=`${p.id}_${topic}`;
        rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",trainer?.name||"",p.date,topic,planStatuses[key]||"Pending"]);
      }));
    });
    downloadCSV(`PlanStatus_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportExitDetails=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Trainer","Joining Date","Left Date","Reporting Manager","Exit Type","Notice Period Served","Resignation Given In","Primary Exit Reason"];
    const rows=filtered.filter(t=>t.leftDate).map(t=>{
      const trainer=trainers.find(tr=>tr.id===t.trainerId);
      return[t.name,t.empId,t.channel||"",t.location||"",t.division||"",trainer?.name||"",
        t.joiningDate||"",t.leftDate||"",t.reportingManager||"",t.exitType||"",t.noticePeriod||"",t.resignChannel||"",t.exitReason||""];
    });
    if(!rows.length){alert("No left trainees in current filter");return;}
    downloadCSV(`ExitDetails_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  return(
    <div className="section">
      <h2 className="section-title">Reports</h2>
      <Card className="form-card">
        <div className="date-row">
          <Input label="From" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
          <Input label="To" type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/>
        </div>
        <div className="date-row">
          <Sel label="Status" options={[{value:"all",label:"All"},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"left",label:"Left"}]} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}/>
          {(masters.channels||[]).length>0&&<Sel label="Channel" options={["All",...(masters.channels||[])]} value={filterCh} onChange={e=>setFilterCh(e.target.value==="All"?"":e.target.value)}/>}
        </div>
        <div className="date-row">
          {(masters.locations||[]).length>0&&<Sel label="Location" options={["All",...(masters.locations||[])]} value={filterLoc} onChange={e=>setFilterLoc(e.target.value==="All"?"":e.target.value)}/>}
          {(masters.divisions||[]).length>0&&<Sel label="Division" options={["All",...(masters.divisions||[])]} value={filterDiv} onChange={e=>setFilterDiv(e.target.value==="All"?"":e.target.value)}/>}
        </div>
        <p className="report-count">{filtered.length} trainee{filtered.length!==1?"s":""} in selection</p>
      </Card>
      <div className="filter-tabs">
        {[["attendance","📅 Attendance"],["activity","🏃 Activity"],["feedback","💬 Feedback"],["planstatus","📋 Plan Status"],["exit","🚪 Exit Details"]].map(([id,lbl])=>(
          <button key={id} className={`filter-tab${activeRep===id?" active":""}`} onClick={()=>setActiveRep(id)}>{lbl}</button>
        ))}
      </div>
      {activeRep==="attendance"&&<Card><div className="rep-head">Attendance Report</div><p className="rep-desc">Daily status per trainee. Blank = not marked.</p><Btn onClick={exportAttendance} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="activity"&&<Card><div className="rep-head">Activity Report</div><p className="rep-desc">All logged activities with GPS & timestamps.</p><Btn onClick={exportActivity} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="feedback"&&<Card><div className="rep-head">Feedback Report</div><p className="rep-desc">All feedback ratings and comments.</p><Btn onClick={exportFeedback} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="planstatus"&&<Card><div className="rep-head">Plan Status Report</div><p className="rep-desc">Topic-wise Pending / Completed status per trainee.</p><Btn onClick={exportPlanStatus} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="exit"&&<Card><div className="rep-head">Exit Details Report</div><p className="rep-desc">Exit info — type, reason, notice period for left trainees.</p><Btn onClick={exportExitDetails} fullWidth>⬇ Download CSV</Btn></Card>}
    </div>
  );
}

// ── Staff Activity Panel (Admin + Trainer log for trainees) ──────
function StaffActivityPanel({role,user,db,patch,activityTypes}){
  const trainees=(db.trainees||[]).filter(t=>
    role==="admin"?true:t.trainerId===user.id
  ).filter(t=>!t.leftDate&&t.active!==false);
  const activities=db.activities||[];
  const [form,setForm]=useState({traineeId:"",type:"",description:"",date:today()});
  const [err,setErr]=useState("");

  const submit=()=>{
    setErr("");
    if(!form.traineeId||!form.type||!form.description){setErr("Select trainee, type and add description");return;}
    patch("activities",[...activities,{...form,id:uid(),loggedBy:role==="admin"?"admin":user.name}]);
    setForm({traineeId:"",type:"",description:"",date:today()});
  };

  const myLogs=[...activities].filter(a=>a.loggedBy&&a.loggedBy!=="trainee").reverse().slice(0,30);
  const allTypes=activityTypes.length>0?activityTypes:ACTIVITY_TYPES;

  return(
    <div className="section">
      <h2 className="section-title">Log Activity for Trainee</h2>
      <Card className="form-card">
        <Sel label="Select Trainee *" options={trainees.map(t=>({value:t.id,label:t.name}))} value={form.traineeId} onChange={e=>setForm({...form,traineeId:e.target.value})}/>
        <Input label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        <Sel label="Activity Type *" options={allTypes} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/>
        <Textarea label="Description *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the activity…" rows={3}/>
        {err&&<p className="err-msg">{err}</p>}
        <Btn onClick={submit}>Log Activity</Btn>
      </Card>
      <h3 className="sub-title">Recently Logged</h3>
      {myLogs.length===0?<p className="empty">No activities logged yet.</p>:myLogs.map(a=>{
        const t=(db.trainees||[]).find(x=>x.id===a.traineeId);
        return(
          <Card key={a.id} className="activity-row">
            <div className="act-head">
              <span style={{fontWeight:600,fontSize:13}}>{t?.name||"?"}</span>
              <Badge text={a.type} color="blue"/>
              <span className="act-date">{fmt(a.date)}</span>
            </div>
            <p className="act-desc">{a.description}</p>
            <p className="gps-coords">Logged by: {a.loggedBy}</p>
          </Card>
        );
      })}
    </div>
  );
}

// ── Trainer Dashboard ────────────────────────────────────────────
function TrainerDashboard({user,db}){
  const my=(db.trainees||[]).filter(t=>t.trainerId===user.id&&!t.leftDate&&t.active!==false);
  const todayAtt=(db.attendance||[]).filter(a=>a.date===today()&&my.some(t=>t.id===a.traineeId));
  const present=todayAtt.filter(a=>a.status==="Present").length;
  const myFb=(db.feedbacks||[]).filter(f=>my.some(t=>t.id===f.traineeId));
  const avg=myFb.length?(myFb.reduce((s,f)=>s+(f.sessionRate||0),0)/myFb.length).toFixed(1):"—";
  return(
    <div className="section">
      <h2 className="section-title">Trainer Dashboard</h2><p className="section-date">{fmt(today())}</p>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num accent">{my.length}</div><div className="stat-lbl">My Trainees</div></div>
        <div className="stat-card"><div className="stat-num">{present}/{my.length}</div><div className="stat-lbl">Present Today</div></div>
        <div className="stat-card"><div className="stat-num">{(db.plans||[]).filter(p=>p.date===today()&&my.some(t=>t.id===p.traineeId)).length}</div><div className="stat-lbl">Plans Today</div></div>
        <div className="stat-card"><div className="stat-num accent">⭐ {avg}</div><div className="stat-lbl">Avg Rating</div></div>
      </div>
      <h3 className="sub-title">Today's Attendance</h3>
      {my.map(t=>{
        const att=todayAtt.find(a=>a.traineeId===t.id);
        return(
          <div key={t.id} className="mini-trainee-row">
            <span>{t.name}</span>
            {att?<Badge text={att.status} color={att.status==="Present"?"green":att.status==="Leave"?"blue":"red"}/>:<Badge text="Not Marked" color="red"/>}
          </div>
        );
      })}
    </div>
  );
}

// ── Trainees Panel (Trainer) ─────────────────────────────────────
function TraineesPanel({user,db,patch}){
  const trainees=db.trainees||[];
  const mine=trainees.filter(t=>t.trainerId===user.id);
  const masters=db.masters||{};
  const [adding,setAdding]=useState(false);
  const [leftModal,setLeftModal]=useState(null);
  const [exitForm,setExitForm]=useState({leftDate:today(),reportingManager:"",rmCustom:"",rmMode:"select",exitType:"",noticePeriod:"",resignChannel:"",exitReason:"",voiceCallData:"",voiceCallName:"",exitInterviewData:"",exitInterviewName:""});
  const exitFileRef=useRef();
  const exitVoiceRef=useRef();
  const [pwModal,setPwModal]=useState(null); const [newPw,setNewPw]=useState("");
  const [form,setForm]=useState({name:"",empId:"",email:"",password:"",mobile:"",joiningDate:today(),channel:"",location:"",division:""});
  const [err,setErr]=useState("");

  const add=()=>{
    setErr("");
    if(!form.name||!form.empId||!form.email||!form.password){setErr("Name, Emp ID, Email, Password required");return;}
    // same email allowed if existing users with that email are all inactive/left
    const existing=trainees.filter(t=>t.email?.toLowerCase()===form.email.toLowerCase());
    if(existing.some(t=>t.active!==false&&!t.leftDate)){setErr("Email used by an active trainee");return;}
    if(trainees.find(t=>t.empId===form.empId)){setErr("Emp ID exists");return;}
    patch("trainees",[...trainees,{...form,id:uid(),trainerId:user.id,active:true}]);
    setForm({name:"",empId:"",email:"",password:"",mobile:"",joiningDate:today(),channel:"",location:"",division:""}); setAdding(false);
  };
  const markLeft=()=>{
    if(!exitForm.leftDate){alert("Enter last working date");return;}
    patch("trainees",trainees.map(t=>t.id===leftModal?{...t,...exitForm,active:false}:t));
    setLeftModal(null);
    setExitForm({leftDate:today(),reportingManager:"",rmCustom:"",rmMode:"select",exitType:"",noticePeriod:"",resignChannel:"",exitReason:"",voiceCallData:"",voiceCallName:"",exitInterviewData:"",exitInterviewName:""});
  };
  const changePw=()=>{if(!newPw.trim())return;patch("trainees",trainees.map(t=>t.id===pwModal?{...t,password:newPw}:t));setPwModal(null);setNewPw("");};

  return(
    <div className="section">
      <div className="section-header"><h2 className="section-title">My Trainees</h2><Btn small onClick={()=>setAdding(!adding)}>{adding?"Cancel":"+ Add"}</Btn></div>
      {adding&&(
        <Card className="form-card">
          <Input label="Full Name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Trainee full name"/>
          <Input label="Employee ID *" value={form.empId} onChange={e=>setForm({...form,empId:e.target.value})} placeholder="e.g. EMP001"/>
          <Input label="Email *" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="trainee@company.com"/>
          <Input label="Password *" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Set login password"/>
          <Input label="Mobile" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="Mobile"/>
          <Input label="Joining Date" type="date" value={form.joiningDate} onChange={e=>setForm({...form,joiningDate:e.target.value})}/>
          {(masters.channels||[]).length>0&&<Sel label="Channel" options={masters.channels} value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}/>}
          {(masters.locations||[]).length>0&&<Sel label="Location" options={masters.locations} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>}
          {(masters.divisions||[]).length>0&&<Sel label="Division" options={masters.divisions} value={form.division} onChange={e=>setForm({...form,division:e.target.value})}/>}
          {err&&<p className="err-msg">{err}</p>}
          <Btn onClick={add}>Create Trainee Login</Btn>
        </Card>
      )}
      {mine.map(t=>(
        <Card key={t.id}>
          <div className="trainee-row">
            <div className="trainee-info">
              <div className={`trainee-avatar${(t.leftDate||t.active===false)?" left":""}`}>{t.name[0]}</div>
              <div>
                <div className="trainee-name">{t.name}
                  {t.leftDate&&<span className="left-tag">Left</span>}
                  {t.active===false&&!t.leftDate&&<span className="left-tag" style={{background:"var(--text2)"}}>Inactive</span>}
                </div>
                <div className="trainee-meta">{t.email}</div>
                <div className="trainee-meta">{t.empId} · {fmt(t.joiningDate)}</div>
                {[t.channel,t.location,t.division].filter(Boolean).length>0&&
                  <div className="trainee-meta">🏢 {[t.channel,t.location,t.division].filter(Boolean).join(" · ")}</div>}
              </div>
            </div>
            <Badge text={t.leftDate?"Left":t.active===false?"Inactive":"Active"} color={t.leftDate?"red":t.active===false?"red":"green"}/>
          </div>
          {!t.leftDate&&(
            <div className="action-row">
              <Btn small variant="secondary" onClick={()=>{setPwModal(t.id);setNewPw("");}}>Reset PW</Btn>
              <Btn small variant="danger" onClick={()=>{setLeftModal(t.id);setExitForm({leftDate:today(),reportingManager:"",rmCustom:"",rmMode:"select",exitType:"",noticePeriod:"",resignChannel:"",exitReason:"",voiceCallData:"",voiceCallName:"",exitInterviewData:"",exitInterviewName:""});}}>Mark Left</Btn>
            </div>
          )}
          {pwModal===t.id&&(
            <div className="inline-add" style={{marginTop:8}}>
              <input value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password…" className="inline-input"/>
              <button className="inline-btn" onClick={changePw}>Save</button>
              <button className="inline-btn" style={{color:"var(--text2)"}} onClick={()=>setPwModal(null)}>✕</button>
            </div>
          )}
        </Card>
      ))}
      {leftModal&&(
        <Modal title="Mark Trainee as Left" onClose={()=>setLeftModal(null)}>
          <Input label="Last Working Date *" type="date" value={exitForm.leftDate} onChange={e=>setExitForm({...exitForm,leftDate:e.target.value})}/>

          {/* Reporting Manager — toggle between select and type */}
          <div className="field">
            <label>Reporting Manager / Team Leader</label>
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <button className={`rm-toggle-btn${exitForm.rmMode==="select"?" active":""}`} onClick={()=>setExitForm({...exitForm,rmMode:"select",rmCustom:""})}>Select from list</button>
              <button className={`rm-toggle-btn${exitForm.rmMode==="type"?" active":""}`} onClick={()=>setExitForm({...exitForm,rmMode:"type",reportingManager:""})}>Type name</button>
            </div>
            {exitForm.rmMode==="select"?(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[...(db.trainers||[]).filter(t=>t.active).map(t=>t.name),"Not Assigned"].map(n=>(
                  <span key={n} className={`topic-opt${exitForm.reportingManager===n?" selected":""}`}
                    style={{fontSize:11}} onClick={()=>setExitForm({...exitForm,reportingManager:n})}>{n}</span>
                ))}
              </div>
            ):(
              <input value={exitForm.rmCustom} onChange={e=>setExitForm({...exitForm,rmCustom:e.target.value,reportingManager:e.target.value})}
                placeholder="Type Team Leader / Manager name…" style={{width:"100%",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"10px 12px",fontSize:14,fontFamily:"var(--font-body)",outline:"none"}}/>
            )}
          </div>

          <div className="field"><label>Exit Type</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {EXIT_TYPES.map(o=>(
                <span key={o} className={`topic-opt${exitForm.exitType===o?" selected":""}`}
                  style={{fontSize:11}} onClick={()=>setExitForm({...exitForm,exitType:o})}>{o}</span>
              ))}
            </div>
          </div>
          <div className="field"><label>Notice Period Served</label>
            <div style={{display:"flex",gap:8}}>
              {NOTICE_OPTIONS.map(o=>(
                <span key={o} className={`topic-opt${exitForm.noticePeriod===o?" selected":""}`}
                  style={{fontSize:11}} onClick={()=>setExitForm({...exitForm,noticePeriod:o})}>{o}</span>
              ))}
            </div>
          </div>
          <div className="field"><label>Resignation Given In</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {RESIGN_CHANNELS.map(o=>(
                <span key={o} className={`topic-opt${exitForm.resignChannel===o?" selected":""}`}
                  style={{fontSize:11}} onClick={()=>setExitForm({...exitForm,resignChannel:o})}>{o}</span>
              ))}
            </div>
          </div>
          <div className="field"><label>Primary Exit Reason</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {EXIT_REASONS.map(o=>(
                <span key={o} className={`topic-opt${exitForm.exitReason===o?" selected":""}`}
                  style={{fontSize:11}} onClick={()=>setExitForm({...exitForm,exitReason:o})}>{o}</span>
              ))}
            </div>
          </div>

          {/* Voice Call Attachment */}
          <div className="field">
            <label>📞 Voice Call Recording (optional)</label>
            <button className="photo-btn" onClick={()=>exitVoiceRef.current.click()}>🎙 Attach Voice Call</button>
            <input ref={exitVoiceRef} type="file" accept="audio/*,video/*" onChange={e=>{
              const file=e.target.files[0]; if(!file)return;
              const reader=new FileReader();
              reader.onload=ev=>setExitForm(f=>({...f,voiceCallData:ev.target.result,voiceCallName:file.name}));
              reader.readAsDataURL(file);
            }} style={{display:"none"}}/>
            {exitForm.voiceCallName&&(
              <div className="attachment-row">
                <span className="attach-icon">🎙</span>
                <span className="attach-name">{exitForm.voiceCallName}</span>
                <button className="attach-remove" onClick={()=>setExitForm(f=>({...f,voiceCallData:"",voiceCallName:""}))}>✕</button>
              </div>
            )}
          </div>

          {/* Exit Interview Form Attachment */}
          <div className="field">
            <label>📄 Exit Interview Form (optional)</label>
            <button className="photo-btn" onClick={()=>exitFileRef.current.click()}>📎 Attach File / PDF / Image</button>
            <input ref={exitFileRef} type="file" accept=".pdf,.doc,.docx,image/*" onChange={e=>{
              const file=e.target.files[0]; if(!file)return;
              const reader=new FileReader();
              reader.onload=ev=>setExitForm(f=>({...f,exitInterviewData:ev.target.result,exitInterviewName:file.name}));
              reader.readAsDataURL(file);
            }} style={{display:"none"}}/>
            {exitForm.exitInterviewName&&(
              <div className="attachment-row">
                <span className="attach-icon">📄</span>
                <span className="attach-name">{exitForm.exitInterviewName}</span>
                <button className="attach-remove" onClick={()=>setExitForm(f=>({...f,exitInterviewData:"",exitInterviewName:""}))}>✕</button>
              </div>
            )}
          </div>

          <Btn onClick={markLeft} variant="danger" fullWidth>Confirm Mark Left</Btn>
        </Modal>
      )}
    </div>
  );
}

// ── Training Plan Panel ──────────────────────────────────────────
function TrainingPlanPanel({user,db,patch,allTopics}){
  const my=(db.trainees||[]).filter(t=>t.trainerId===user.id&&!t.leftDate&&t.active!==false);
  const plans=db.plans||[]; const taskMaster=db.masters?.tasks||[];
  const [form,setForm]=useState({traineeId:"",date:today(),topics:[],tasks:[],notes:""});
  const [adding,setAdding]=useState(false); const [newTopic,setNewTopic]=useState("");
  const toggle=(arr,k,item)=>setForm(f=>({...f,[k]:f[k].includes(item)?f[k].filter(x=>x!==item):[...f[k],item]}));
  const addCT=()=>{
    if(!newTopic.trim())return;
    const ct=db.customTopics||[];
    if(!allTopics.includes(newTopic.trim()))patch("customTopics",[...ct,newTopic.trim()]);
    setNewTopic("");
  };
  const save=()=>{
    if(!form.traineeId||!form.topics.length){alert("Select trainee and at least one topic");return;}
    patch("plans",[...plans,{...form,id:uid()}]);
    setForm({traineeId:"",date:today(),topics:[],tasks:[],notes:""}); setAdding(false);
  };
  const myPlans=plans.filter(p=>my.some(t=>t.id===p.traineeId));
  return(
    <div className="section">
      <div className="section-header"><h2 className="section-title">Training Plans</h2><Btn small onClick={()=>setAdding(!adding)}>{adding?"Cancel":"+ Assign"}</Btn></div>
      {adding&&(
        <Card className="form-card">
          <Sel label="Trainee *" options={my.map(t=>({value:t.id,label:t.name}))} value={form.traineeId} onChange={e=>setForm({...form,traineeId:e.target.value})}/>
          <Input label="Date *" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          <div className="field"><label>Topics *</label>
            <div className="topic-selector">{allTopics.map(t=>(
              <span key={t} className={`topic-opt${form.topics.includes(t)?" selected":""}`} onClick={()=>toggle("topics","topics",t)}>{t}</span>
            ))}</div>
          </div>
          <div className="inline-add">
            <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Custom topic…" className="inline-input"/>
            <button className="inline-btn" onClick={addCT}>+ Add</button>
          </div>
          {taskMaster.length>0&&(
            <div className="field"><label>Assign Tasks (optional)</label>
              <div className="topic-selector">{taskMaster.map(t=>(
                <span key={t} className={`topic-opt task-opt${form.tasks.includes(t)?" selected":""}`} onClick={()=>toggle("tasks","tasks",t)}>{t}</span>
              ))}</div>
            </div>
          )}
          <Textarea label="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}/>
          <Btn onClick={save}>Assign Plan</Btn>
        </Card>
      )}
      {[...myPlans].reverse().map(p=>{
        const trainee=my.find(t=>t.id===p.traineeId);
        return(
          <Card key={p.id} className="plan-card">
            <div className="plan-header">
              <strong>{trainee?.name||"Unknown"}</strong>
              <span className="plan-date">{fmt(p.date)}</span>
              <button className="del-btn" onClick={()=>patch("plans",plans.filter(x=>x.id!==p.id))}>✕</button>
            </div>
            <div className="topic-chips">{p.topics.map(t=><span key={t} className="chip">{t}</span>)}</div>
            {p.tasks&&p.tasks.length>0&&<div className="topic-chips" style={{marginTop:6}}>{p.tasks.map(t=><span key={t} className="chip task-chip">{t}</span>)}</div>}
            {p.notes&&<p className="plan-notes">{p.notes}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ── Attendance View (Trainer) ────────────────────────────────────
function AttendanceViewPanel({user,db}){
  const my=(db.trainees||[]).filter(t=>t.trainerId===user.id);
  const [date,setDate]=useState(today());
  const att=(db.attendance||[]).filter(a=>a.date===date&&my.some(t=>t.id===a.traineeId));
  return(
    <div className="section">
      <h2 className="section-title">Attendance View</h2>
      <Input label="Date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      {my.map(t=>{
        const r=att.find(a=>a.traineeId===t.id);
        return(
          <Card key={t.id} className="att-row">
            <div className="att-info"><div className="trainee-avatar sm">{t.name[0]}</div><div><div className="trainee-name">{t.name}</div><div className="trainee-meta">{t.empId}</div></div></div>
            {r?<Badge text={r.status} color={r.status==="Present"?"green":r.status==="Leave"?"blue":"red"}/>:<Badge text="Not Marked" color="red"/>}
          </Card>
        );
      })}
    </div>
  );
}

// ── Trainer Reports ──────────────────────────────────────────────
function TrainerReports({user,db}){
  const myTrainees=(db.trainees||[]).filter(t=>t.trainerId===user.id);
  const masters=db.masters||{};
  const [fromDate,setFromDate]=useState(today()); const [toDate,setToDate]=useState(today());
  const [filterStatus,setFilterStatus]=useState("active");
  const [filterLoc,setFilterLoc]=useState(""); const [filterDiv,setFilterDiv]=useState(""); const [filterCh,setFilterCh]=useState("");
  const [activeRep,setActiveRep]=useState("attendance");

  const filtered=myTrainees.filter(t=>{
    if(filterLoc&&t.location!==filterLoc)return false;
    if(filterDiv&&t.division!==filterDiv)return false;
    if(filterCh&&t.channel!==filterCh)return false;
    if(filterStatus==="active"&&(t.leftDate||t.active===false))return false;
    if(filterStatus==="inactive"&&t.active!==false)return false;
    if(filterStatus==="left"&&!t.leftDate)return false;
    return true;
  });

  const getDates=(from,to)=>{
    const dates=[]; let d=new Date(from);
    while(d<=new Date(to)){dates.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
    return dates;
  };

  const exportAttendance=()=>{
    const dates=getDates(fromDate,toDate);
    const header=["Name","Emp ID","Channel","Location","Division",...dates,"Present","Absent","Leave"];
    const rows=filtered.map(t=>{
      const daily=dates.map(d=>{
        const r=(db.attendance||[]).find(a=>a.traineeId===t.id&&a.date===d);
        return r?r.status:"";
      });
      return[t.name,t.empId,t.channel||"",t.location||"",t.division||"",...daily,
        daily.filter(s=>s==="Present").length,daily.filter(s=>s==="Absent").length,daily.filter(s=>s==="Leave").length];
    });
    downloadCSV(`Attendance_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportActivity=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Date","Type","Description","GPS Lat","GPS Lng","Timestamp","Logged By"];
    const rows=[];
    filtered.forEach(t=>{
      const acts=(db.activities||[]).filter(a=>a.traineeId===t.id&&a.date>=fromDate&&a.date<=toDate);
      if(!acts.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"","","","","","","",""]);
      else acts.forEach(a=>rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",a.date,a.type,a.description,a.lat||"",a.lng||"",a.timestamp||"",a.loggedBy||"trainee"]));
    });
    downloadCSV(`Activity_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportFeedback=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Date","Topic","Trainer Name","Session Rating","Clarity","Relevance","Materials","Engaging Aspects","Comments"];
    const rows=[];
    filtered.forEach(t=>{
      const fbs=(db.feedbacks||[]).filter(f=>f.traineeId===t.id&&f.date>=fromDate&&f.date<=toDate);
      if(!fbs.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"","","","","","","","","",""]);
      else fbs.forEach(f=>rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",f.date,f.topic||"",f.trainerName||"",f.sessionRate||"",f.clarity||"",f.relevance||"",f.materials||"",(f.aspects||[]).join("; "),f.comment||""]));
    });
    downloadCSV(`Feedback_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportPlanStatus=()=>{
    const planStatuses=db.planStatuses||{};
    const header=["Name","Emp ID","Channel","Location","Division","Plan Date","Topic","Status"];
    const rows=[];
    filtered.forEach(t=>{
      const plans=(db.plans||[]).filter(p=>p.traineeId===t.id&&p.date>=fromDate&&p.date<=toDate);
      if(!plans.length) rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"","","",""]);
      else plans.forEach(p=>p.topics.forEach(topic=>{
        const key=`${p.id}_${topic}`;
        rows.push([t.name,t.empId,t.channel||"",t.location||"",t.division||"",p.date,topic,planStatuses[key]||"Pending"]);
      }));
    });
    downloadCSV(`PlanStatus_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const exportExitDetails=()=>{
    const header=["Name","Emp ID","Channel","Location","Division","Joining Date","Left Date","Reporting Manager","Exit Type","Notice Period","Resignation Given In","Primary Exit Reason"];
    const rows=filtered.filter(t=>t.leftDate).map(t=>[
      t.name,t.empId,t.channel||"",t.location||"",t.division||"",t.joiningDate||"",t.leftDate||"",
      t.reportingManager||"",t.exitType||"",t.noticePeriod||"",t.resignChannel||"",t.exitReason||""
    ]);
    if(!rows.length){alert("No left trainees in current filter");return;}
    downloadCSV(`ExitDetails_${fromDate}_to_${toDate}.csv`,[header,...rows]);
  };

  const repTabs=[
    {id:"attendance",label:"📅 Attendance"},
    {id:"activity",label:"🏃 Activity"},
    {id:"feedback",label:"💬 Feedback"},
    {id:"planstatus",label:"📋 Plan Status"},
    {id:"exit",label:"🚪 Exit Details"},
  ];

  return(
    <div className="section">
      <h2 className="section-title">Reports</h2>
      <Card className="form-card">
        <div className="date-row">
          <Input label="From" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
          <Input label="To" type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/>
        </div>
        <div className="date-row">
          <Sel label="Status" options={[{value:"all",label:"All"},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"left",label:"Left"}]} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}/>
          {(masters.channels||[]).length>0&&<Sel label="Channel" options={["All",...(masters.channels||[])]} value={filterCh} onChange={e=>setFilterCh(e.target.value==="All"?"":e.target.value)}/>}
        </div>
        <div className="date-row">
          {(masters.locations||[]).length>0&&<Sel label="Location" options={["All",...(masters.locations||[])]} value={filterLoc} onChange={e=>setFilterLoc(e.target.value==="All"?"":e.target.value)}/>}
          {(masters.divisions||[]).length>0&&<Sel label="Division" options={["All",...(masters.divisions||[])]} value={filterDiv} onChange={e=>setFilterDiv(e.target.value==="All"?"":e.target.value)}/>}
        </div>
        <p className="report-count">{filtered.length} trainee{filtered.length!==1?"s":""} in selection</p>
      </Card>
      <div className="filter-tabs">
        {repTabs.map(r=><button key={r.id} className={`filter-tab${activeRep===r.id?" active":""}`} onClick={()=>setActiveRep(r.id)}>{r.label}</button>)}
      </div>
      {activeRep==="attendance"&&<Card><div className="rep-head">Attendance Report</div><p className="rep-desc">Daily status. Blank = not marked.</p><Btn onClick={exportAttendance} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="activity"&&<Card><div className="rep-head">Activity Report</div><p className="rep-desc">All logged activities with GPS & timestamps.</p><Btn onClick={exportActivity} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="feedback"&&<Card><div className="rep-head">Feedback Report</div><p className="rep-desc">All feedback ratings and comments.</p><Btn onClick={exportFeedback} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="planstatus"&&<Card><div className="rep-head">Plan Status Report</div><p className="rep-desc">Topic-wise Pending / Completed status per trainee.</p><Btn onClick={exportPlanStatus} fullWidth>⬇ Download CSV</Btn></Card>}
      {activeRep==="exit"&&<Card><div className="rep-head">Exit Details Report</div><p className="rep-desc">Exit info for left trainees — exit type, reason, notice period.</p><Btn onClick={exportExitDetails} fullWidth>⬇ Download CSV</Btn></Card>}
    </div>
  );
}

// ── Joiner Dashboard ─────────────────────────────────────────────
function JoinerDashboard({user,db}){
  const myPlans=(db.plans||[]).filter(p=>p.traineeId===user.id&&p.date===today());
  const myAtt=(db.attendance||[]).find(a=>a.traineeId===user.id&&a.date===today());
  const myFb=(db.feedbacks||[]).filter(f=>f.traineeId===user.id);
  const avg=myFb.length?(myFb.reduce((s,f)=>s+(f.sessionRate||0),0)/myFb.length).toFixed(1):"—";
  return(
    <div className="section">
      <h2 className="section-title">Welcome 👋</h2>
      <p className="section-date">{user.name} · {fmt(today())}</p>
      <div className="stat-grid">
        <div className="stat-card"><div className={`stat-num ${myAtt?.status==="Present"?"accent":"red"}`}>{myAtt?.status||"Not Marked"}</div><div className="stat-lbl">Today's Attendance</div></div>
        <div className="stat-card"><div className="stat-num">{myPlans.reduce((s,p)=>s+p.topics.length,0)}</div><div className="stat-lbl">Topics Today</div></div>
        <div className="stat-card"><div className="stat-num accent">⭐ {avg}</div><div className="stat-lbl">Avg Rating</div></div>
        <div className="stat-card"><div className="stat-num">{(db.activities||[]).filter(a=>a.traineeId===user.id).length}</div><div className="stat-lbl">Activities</div></div>
      </div>
      <h3 className="sub-title">Today's Training</h3>
      {myPlans.length===0?<p className="empty">No plan assigned yet.</p>:myPlans.map(p=>(
        <Card key={p.id} className="plan-card">
          <div className="topic-chips">{p.topics.map(t=><span key={t} className="chip">{t}</span>)}</div>
          {p.tasks&&p.tasks.length>0&&<div className="topic-chips" style={{marginTop:6}}>{p.tasks.map(t=><span key={t} className="chip task-chip">{t}</span>)}</div>}
          {p.notes&&<p className="plan-notes">📌 {p.notes}</p>}
        </Card>
      ))}
    </div>
  );
}

// ── Trainee Attendance ───────────────────────────────────────────
function TraineeAttendance({user,db,patch}){
  const [date,setDate]=useState(today());
  const att=db.attendance||[];
  const existing=att.find(a=>a.traineeId===user.id&&a.date===date);
  const allowed=date===today()||date===yesterday();
  const mark=(status)=>{
    if(!allowed){alert("Only today or yesterday allowed");return;}
    const filtered=att.filter(a=>!(a.traineeId===user.id&&a.date===date));
    patch("attendance",[...filtered,{traineeId:user.id,date,status,id:uid()}]);
  };
  return(
    <div className="section">
      <h2 className="section-title">Mark Attendance</h2>
      <Input label="Date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      {!allowed&&<p className="err-msg">⚠ Only today or yesterday allowed</p>}
      <Card>
        <p style={{marginBottom:12,fontSize:13,color:"var(--text2)"}}>Status for {fmt(date)}:</p>
        <div className="att-btn-group">
          {ATT_OPTIONS.map(opt=>(
            <button key={opt} className={`att-big-btn ${opt.toLowerCase()}${existing?.status===opt?" active":""}`}
              onClick={()=>mark(opt)} disabled={!allowed}>
              {opt==="Present"?"✓":opt==="Absent"?"✗":"🏖"} {opt}
            </button>
          ))}
        </div>
        {existing&&<p className="success-msg" style={{marginTop:10}}>Marked as {existing.status} ✅</p>}
      </Card>
      <h3 className="sub-title">History</h3>
      {att.filter(a=>a.traineeId===user.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(a=>(
        <div key={a.id} className="mini-trainee-row">
          <span>{fmt(a.date)}</span>
          <Badge text={a.status} color={a.status==="Present"?"green":a.status==="Leave"?"blue":"red"}/>
        </div>
      ))}
    </div>
  );
}

// ── My Plan (Trainee) — topic Pending/Completed status only ────────
function MyPlanPanel({user,db,patch}){
  const [selDate,setSelDate]=useState(today());
  const myPlans=(db.plans||[]).filter(p=>p.traineeId===user.id&&p.date===selDate);
  const planStatuses=db.planStatuses||{};
  const feedbacks=db.feedbacks||[];
  const [submitting,setSubmitting]=useState(false);
  const [fbForm,setFbForm]=useState({topic:"",sessionRate:0,clarity:0,relevance:0,materials:0,aspects:[],comment:""});

  const setTopicStatus=(planId,topic,status)=>{
    const key=`${planId}_${topic}`;
    patch("planStatuses",{...planStatuses,[key]:status});
  };
  const getStatus=(planId,topic)=>planStatuses[`${planId}_${topic}`]||"Pending";

  const toggleAspect=(a)=>setFbForm(f=>({...f,aspects:f.aspects.includes(a)?f.aspects.filter(x=>x!==a):[...f.aspects,a]}));
  const submitFb=()=>{
    if(!fbForm.topic||!fbForm.sessionRate){alert("Select topic and session rating");return;}
    if(!isValidDate(selDate)){alert("Only today or yesterday allowed");return;}
    patch("feedbacks",[...feedbacks,{...fbForm,id:uid(),traineeId:user.id,date:selDate}]);
    setFbForm({topic:"",sessionRate:0,clarity:0,relevance:0,materials:0,aspects:[],comment:""}); setSubmitting(false);
  };

  return(
    <div className="section">
      <h2 className="section-title">My Training Plan</h2>
      <Input label="Date" type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}/>
      {myPlans.length===0?<p className="empty">No plan for this date.</p>:myPlans.map(p=>(
        <Card key={p.id} className="plan-card">
          {p.topics.map(topic=>{
            const st=getStatus(p.id,topic);
            return(
              <div key={topic} className="topic-status-row">
                <span className="topic-status-name">{topic}</span>
                <div className="topic-status-btns">
                  <button className={`status-btn pending${st==="Pending"?" active":""}`}
                    onClick={()=>setTopicStatus(p.id,topic,"Pending")}>⏳ Pending</button>
                  <button className={`status-btn completed${st==="Completed"?" active":""}`}
                    onClick={()=>setTopicStatus(p.id,topic,"Completed")}>✓ Done</button>
                </div>
              </div>
            );
          })}
          {p.tasks&&p.tasks.length>0&&<div className="topic-chips" style={{marginTop:8}}>{p.tasks.map(t=><span key={t} className="chip task-chip">{t}</span>)}</div>}
          {p.notes&&<p className="plan-notes">📌 {p.notes}</p>}
        </Card>
      ))}
      {myPlans.length>0&&(
        <>
          <div className="section-header" style={{marginTop:16}}>
            <h3 className="sub-title" style={{margin:0}}>Submit Feedback</h3>
            <Btn small onClick={()=>setSubmitting(!submitting)}>{submitting?"Cancel":"+ Add"}</Btn>
          </div>
          {submitting&&(
            <Card className="form-card">
              <Sel label="Topic *" options={myPlans.flatMap(p=>p.topics)} value={fbForm.topic} onChange={e=>setFbForm({...fbForm,topic:e.target.value})}/>
              {FEEDBACK_CRITERIA.map(c=>(
                <div key={c.key} className="field">
                  <label>{c.label}</label>
                  <div className="fb-criterion-sub">{c.sub} — <span className="fb-tap-hint">Tap to rate</span></div>
                  <StarRating value={fbForm[c.key]} onChange={r=>setFbForm({...fbForm,[c.key]:r})} size="lg"/>
                </div>
              ))}
              <div className="field"><label>Most engaging aspects?</label>
                <div className="topic-selector">{ENGAGING_ASPECTS.map(a=>(
                  <span key={a} className={`topic-opt${fbForm.aspects.includes(a)?" selected":""}`} onClick={()=>toggleAspect(a)}>{a}</span>
                ))}</div>
              </div>
              <Textarea label="Comments" value={fbForm.comment} onChange={e=>setFbForm({...fbForm,comment:e.target.value})} rows={3}/>
              <Btn onClick={submitFb}>Submit Feedback</Btn>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Feedback Panel (Trainee) ─────────────────────────────────────
function FeedbackPanel({user,db,patch,allTopics}){
  const feedbacks=db.feedbacks||[];
  const trainers=db.trainers||[];
  const [form,setForm]=useState({topic:"",trainerName:"",sessionRate:0,clarity:0,relevance:0,materials:0,aspects:[],comment:"",date:today()});
  const [customTrainer,setCustomTrainer]=useState("");
  const toggleAspect=(a)=>setForm(f=>({...f,aspects:f.aspects.includes(a)?f.aspects.filter(x=>x!==a):[...f.aspects,a]}));

  // trainer name: select from list or type custom
  const trainerOptions=[...trainers.filter(t=>t.active).map(t=>({value:t.name,label:t.name})),{value:"__other__",label:"Other — Type name"}];

  const effectiveTrainerName=form.trainerName==="__other__"?customTrainer:form.trainerName;

  const submit=()=>{
    if(!form.topic||!form.sessionRate){alert("Select topic and session rating");return;}
    if(!isValidDate(form.date)){alert("Only today or yesterday allowed");return;}
    patch("feedbacks",[...feedbacks,{...form,trainerName:effectiveTrainerName,id:uid(),traineeId:user.id}]);
    setForm({topic:"",trainerName:"",sessionRate:0,clarity:0,relevance:0,materials:0,aspects:[],comment:"",date:today()});
    setCustomTrainer("");
  };

  const myTopics=allTopics.length>0?allTopics:FIXED_TOPICS;

  return(
    <div className="section">
      <h2 className="section-title">Training Feedback</h2>
      <Card className="form-card">
        <Input label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        {!isValidDate(form.date)&&<p className="err-msg">⚠ Only today or yesterday allowed</p>}
        <Sel label="Training Topic *" options={myTopics} value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/>
        <Sel label="Trainer Name" options={trainerOptions} value={form.trainerName} onChange={e=>setForm({...form,trainerName:e.target.value})}/>
        {form.trainerName==="__other__"&&(
          <Input label="Enter Trainer Name" value={customTrainer} onChange={e=>setCustomTrainer(e.target.value)} placeholder="Type trainer name…"/>
        )}
        {FEEDBACK_CRITERIA.map(c=>(
          <div key={c.key} className="field">
            <label>{c.label}</label>
            <div className="fb-criterion-sub">{c.sub} — <span className="fb-tap-hint">Tap to rate</span></div>
            <StarRating value={form[c.key]} onChange={r=>setForm({...form,[c.key]:r})} size="lg"/>
          </div>
        ))}
        <div className="field"><label>Most engaging aspects?</label>
          <div className="topic-selector">{ENGAGING_ASPECTS.map(a=>(
            <span key={a} className={`topic-opt${form.aspects.includes(a)?" selected":""}`} onClick={()=>toggleAspect(a)}>{a}</span>
          ))}</div>
        </div>
        <Textarea label="Comments" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})} placeholder="Any other feedback…" rows={3}/>
        <Btn onClick={submit}>Submit Feedback</Btn>
      </Card>
      <h3 className="sub-title">My Feedbacks</h3>
      {feedbacks.filter(f=>f.traineeId===user.id).reverse().slice(0,10).map(f=>(
        <Card key={f.id} className="fb-row">
          <div className="fb-head"><span>{f.topic}</span><StarRating value={f.sessionRate||0} readOnly/><span className="act-date">{fmt(f.date)}</span></div>
          {f.trainerName&&<p className="fb-comment">Trainer: {f.trainerName}</p>}
          {f.aspects&&f.aspects.length>0&&<div className="topic-chips" style={{marginTop:4}}>{f.aspects.map(a=><span key={a} className="chip">{a}</span>)}</div>}
          {f.comment&&<p className="fb-comment">{f.comment}</p>}
        </Card>
      ))}
    </div>
  );
}

// ── Trainee Activity Panel (GPS + Photo) ────────────────────────────
function TraineeActivityPanel({user,db,patch,activityTypes}){
  const activities=db.activities||[];
  const allTypes=activityTypes.length>0?activityTypes:ACTIVITY_TYPES;
  const [form,setForm]=useState({type:"",description:"",date:today(),lat:"",lng:"",photoData:"",timestamp:""});
  const [gpsLoading,setGpsLoading]=useState(false); const [gpsStatus,setGpsStatus]=useState("");
  const fileRef=useRef();

  const getGPS=()=>{
    setGpsLoading(true);setGpsStatus("");
    if(!navigator.geolocation){setGpsStatus("GPS not supported");setGpsLoading(false);return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{setForm(f=>({...f,lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6),timestamp:new Date().toLocaleString("en-IN")}));setGpsStatus("✅ Location captured");setGpsLoading(false);},
      err=>{setGpsStatus("❌ GPS error: "+err.message);setGpsLoading(false);},
      {enableHighAccuracy:true,timeout:10000}
    );
  };
  const handlePhoto=(e)=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>setForm(f=>({...f,photoData:ev.target.result,timestamp:f.timestamp||new Date().toLocaleString("en-IN")}));
    reader.readAsDataURL(file);
  };
  const submit=()=>{
    if(!form.type||!form.description){alert("Select type and add description");return;}
    if(!isValidDate(form.date)){alert("Only today or yesterday allowed");return;}
    patch("activities",[...activities,{...form,id:uid(),traineeId:user.id,loggedBy:"trainee"}]);
    setForm({type:"",description:"",date:today(),lat:"",lng:"",photoData:"",timestamp:""}); setGpsStatus("");
  };
  const remove=(id)=>patch("activities",activities.filter(a=>a.id!==id));
  const mine=[...activities.filter(a=>a.traineeId===user.id)].reverse();

  return(
    <div className="section">
      <h2 className="section-title">Daily Activities</h2>
      <Card className="form-card">
        <Input label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        {!isValidDate(form.date)&&<p className="err-msg">⚠ Only today or yesterday allowed</p>}
        <Sel label="Activity Type *" options={allTypes} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/>
        <Textarea label="What did you do? *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the activity…" rows={3}/>
        <div className="field"><label>📍 GPS Location</label>
          <div className="gps-row">
            <Btn small variant="secondary" onClick={getGPS} disabled={gpsLoading}>{gpsLoading?"Getting GPS…":"Capture GPS"}</Btn>
            {form.lat&&<a className="gps-link" href={`https://maps.google.com/?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer">📌 View Map</a>}
          </div>
          {gpsStatus&&<p className={gpsStatus.includes("✅")?"success-msg":"err-msg"} style={{marginTop:4}}>{gpsStatus}</p>}
          {form.lat&&<p className="gps-coords">{form.lat}, {form.lng}</p>}
        </div>
        <div className="field"><label>📷 Photo</label>
          <button className="photo-btn" onClick={()=>fileRef.current.click()}>📷 Take / Upload Photo</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{display:"none"}}/>
          {form.photoData&&<img src={form.photoData} alt="Activity" className="photo-preview"/>}
        </div>
        {form.timestamp&&<p className="gps-coords">🕐 {form.timestamp}</p>}
        <Btn onClick={submit}>Log Activity</Btn>
      </Card>
      <h3 className="sub-title">My Activities</h3>
      {mine.length===0?<p className="empty">No activities logged yet.</p>:mine.map(a=>(
        <Card key={a.id} className="activity-row">
          <div className="act-head">
            <Badge text={a.type} color="green"/>
            <span className="act-date">{fmt(a.date)}</span>
            <button className="del-btn" onClick={()=>remove(a.id)}>✕</button>
          </div>
          <p className="act-desc">{a.description}</p>
          {a.lat&&<a className="gps-link" href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">📌 {a.lat}, {a.lng}</a>}
          {a.timestamp&&<p className="gps-coords">🕐 {a.timestamp}</p>}
          {a.photoData&&<img src={a.photoData} alt="Activity" className="photo-preview"/>}
        </Card>
      ))}
    </div>
  );
}

// ── CSS ──────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1117;--surface:#181c27;--surface2:#1e2335;--border:#2a3050;--accent:#f5a623;--accent2:#3b82f6;--green:#22c55e;--red:#ef4444;--text:#e8eaf0;--text2:#8892a4;--font-head:'Rajdhani',sans-serif;--font-body:'DM Sans',sans-serif}
body{background:var(--bg);color:var(--text);font-family:var(--font-body)}
.app{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.header-left{display:flex;align-items:center;gap:10px}
.logo-mark{font-size:22px;color:var(--accent)}
.app-title{font-family:var(--font-head);font-size:18px;font-weight:700;letter-spacing:1px;color:var(--accent)}
.app-sub{font-size:10px;color:var(--text2)}
.header-right{display:flex;align-items:center;gap:8px}
.user-chip{display:flex;align-items:center;gap:6px;font-size:12px;background:var(--surface2);padding:4px 10px;border-radius:20px;border:1px solid var(--border);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.user-role-dot{width:8px;height:8px;border-radius:50%;background:var(--accent2);flex-shrink:0}
.user-role-dot[data-role="trainer"]{background:var(--accent)}
.user-role-dot[data-role="admin"]{background:var(--red)}
.logout-btn{background:none;border:1px solid var(--border);color:var(--text2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px}
.main{flex:1;overflow-y:auto;padding-bottom:72px}
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;display:flex;background:var(--surface);border-top:1px solid var(--border);z-index:10}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;background:none;border:none;color:var(--text2);cursor:pointer;transition:color .2s}
.nav-item.active{color:var(--accent)}
.nav-icon{font-size:18px}
.nav-label{font-size:9px;font-weight:500;letter-spacing:.3px}
.section{padding:16px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.section-title{font-family:var(--font-head);font-size:22px;font-weight:700;margin-bottom:2px}
.section-date{font-size:12px;color:var(--text2);margin-bottom:16px}
.sub-title{font-family:var(--font-head);font-size:15px;font-weight:600;margin:20px 0 10px;color:var(--text2);text-transform:uppercase;letter-spacing:.8px}
.empty{color:var(--text2);font-size:13px;font-style:italic;padding:12px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px}
.form-card{background:var(--surface2)}
.btn{display:inline-block;padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-family:var(--font-head);font-size:15px;font-weight:600;letter-spacing:.5px;transition:opacity .2s}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-primary{background:var(--accent);color:#000}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border)}
.btn-danger{background:var(--red);color:#fff}
.btn-sm{padding:6px 14px;font-size:13px;border-radius:6px}
.btn-full{width:100%}
.field{margin-bottom:12px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
.field input,.field select,.field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px 12px;font-size:14px;font-family:var(--font-body);outline:none}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent2)}
.field textarea{resize:vertical;min-height:72px}
.field select option{background:var(--surface)}
.pw-field .pw-wrap{position:relative}
.pw-field .pw-wrap input{padding-right:40px}
.pw-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px}
.inline-add{display:flex;gap:8px;margin-bottom:12px}
.inline-input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 12px;font-size:13px;font-family:var(--font-body);outline:none}
.inline-btn{background:var(--surface2);border:1px solid var(--border);color:var(--accent);padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;white-space:nowrap}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center}
.stat-num{font-family:var(--font-head);font-size:22px;font-weight:700}
.stat-num.accent{color:var(--accent)}
.stat-num.red{color:var(--red)}
.stat-lbl{font-size:11px;color:var(--text2);margin-top:2px}
.trainee-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.trainee-info{display:flex;align-items:flex-start;gap:10px}
.trainee-avatar{width:38px;height:38px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-size:16px;font-weight:700;flex-shrink:0}
.trainee-avatar.sm{width:30px;height:30px;font-size:13px}
.trainee-avatar.left{background:var(--border);color:var(--text2)}
.trainee-name{font-weight:600;font-size:15px}
.trainee-meta{font-size:11px;color:var(--text2);margin-top:2px}
.del-btn{background:none;border:1px solid var(--border);color:var(--text2);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;flex-shrink:0}
.action-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.left-tag{background:var(--red);color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle}
.red-text{color:var(--red)}
.date-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.plan-card{}
.plan-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.plan-date{font-size:12px;color:var(--text2)}
.plan-notes{font-size:12px;color:var(--text2);margin-top:8px;font-style:italic}
.topic-chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--text2)}
.task-chip{border-color:var(--accent2);color:var(--accent2)}
.topic-selector{display:flex;flex-wrap:wrap;gap:6px}
.topic-opt{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer;transition:all .15s;color:var(--text2)}
.topic-opt.selected{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}
.task-opt.selected{background:var(--accent2);border-color:var(--accent2);color:#fff}
.topic-status-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);gap:8px}
.topic-status-row:last-of-type{border-bottom:none}
.topic-status-name{font-size:13px;font-weight:500;flex:1}
.topic-status-btns{display:flex;gap:6px;flex-shrink:0}
.status-btn{padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text2);font-size:11px;cursor:pointer;font-weight:600;transition:all .15s}
.status-btn.pending.active{background:#2a1f00;border-color:var(--accent);color:var(--accent)}
.status-btn.completed.active{background:#0f2a1a;border-color:var(--green);color:var(--green)}
.att-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.att-info{display:flex;align-items:center;gap:10px}
.att-btn-group{display:flex;gap:10px;flex-wrap:wrap}
.att-big-btn{flex:1;padding:14px 8px;border-radius:10px;border:2px solid var(--border);background:var(--bg);color:var(--text2);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-head);transition:all .2s;min-width:90px}
.att-big-btn.present.active{background:var(--green);border-color:var(--green);color:#000}
.att-big-btn.absent.active{background:var(--red);border-color:var(--red);color:#fff}
.att-big-btn.leave.active{background:var(--accent2);border-color:var(--accent2);color:#fff}
.fb-row{}
.fb-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;font-size:13px;font-weight:600}
.fb-comment{font-size:12px;color:var(--text2);margin-top:2px}
.fb-criterion-sub{font-size:11px;color:var(--text2);margin-bottom:6px}
.fb-tap-hint{font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px}
.stars{display:flex;gap:3px}
.star{font-size:18px;color:var(--border);transition:color .1s}
.star-lg{font-size:28px}
.star.filled{color:var(--accent)}
.star.clickable{cursor:pointer}
.activity-row{}
.act-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.act-date{font-size:11px;color:var(--text2);margin-left:auto}
.act-desc{font-size:13px;color:var(--text2);margin-bottom:6px}
.gps-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gps-link{font-size:12px;color:var(--accent2);text-decoration:none}
.gps-coords{font-size:11px;color:var(--text2);margin-top:4px;font-family:monospace}
.photo-btn{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:var(--font-body)}
.photo-preview{width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid var(--border)}
.badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.badge-blue{background:#1e3a5f;color:var(--accent2)}
.badge-green{background:#14532d;color:var(--green)}
.badge-red{background:#3f1515;color:var(--red)}
.filter-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-tab{padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg);color:var(--text2);font-size:12px;cursor:pointer;font-family:var(--font-body)}
.filter-tab.active{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}
.mini-trainee-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.mini-trainee-row:last-child{border-bottom:none}
.to-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.to-stats{display:flex;gap:12px;font-size:12px;color:var(--text2)}
.err-msg{color:var(--red);font-size:12px;margin-bottom:8px}
.success-msg{color:var(--green);font-size:12px;margin-bottom:8px}
.report-count{font-size:12px;color:var(--accent);margin-top:4px}
.rep-head{font-family:var(--font-head);font-size:16px;font-weight:700;margin-bottom:6px}
.rep-desc{font-size:12px;color:var(--text2);margin-bottom:12px}
.master-tabs{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.master-tab{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text2);font-size:13px;font-weight:500;font-family:var(--font-body);text-align:left;transition:all .2s}
.master-tab.active{border-color:var(--accent);background:var(--surface2);color:var(--text)}
.master-tab-count{margin-left:auto;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:1px 8px;font-size:11px;color:var(--accent)}
.master-tab.active .master-tab-count{background:var(--accent);color:#000;border-color:var(--accent)}
.master-head{display:flex;align-items:flex-start;gap:12px}
.master-icon{font-size:28px;flex-shrink:0}
.master-title{font-family:var(--font-head);font-size:17px;font-weight:700}
.master-desc{font-size:12px;color:var(--text2);margin-top:3px}
.master-item-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px}
.master-item-left{display:flex;align-items:center;gap:10px}
.master-order-btns{display:flex;flex-direction:column;gap:2px}
.order-btn{background:none;border:1px solid var(--border);color:var(--text2);width:20px;height:18px;border-radius:3px;cursor:pointer;font-size:9px;line-height:1;padding:0}
.order-btn:disabled{opacity:.3;cursor:not-allowed}
.master-item-num{font-size:11px;color:var(--text2);width:18px;text-align:center}
.master-item-name{font-size:14px;font-weight:500}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:380px}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);font-family:var(--font-head);font-size:16px;font-weight:600}
.modal-close{background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer}
.modal-body{padding:16px}
.login-wrap{min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px 24px;width:100%;max-width:360px;text-align:center}
.login-logo{font-size:40px;color:var(--accent);margin-bottom:8px}
.login-title{font-family:var(--font-head);font-size:32px;font-weight:700;letter-spacing:2px;color:var(--accent)}
.login-sub{font-size:12px;color:var(--text2);margin-bottom:24px}
.login-form{text-align:left}
.login-hint{font-size:11px;color:var(--text2);text-align:center;margin-top:12px}

.rm-toggle-btn{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text2);font-size:12px;cursor:pointer;font-family:var(--font-body);transition:all .15s}
.rm-toggle-btn.active{background:var(--accent2);border-color:var(--accent2);color:#fff;font-weight:600}
.attachment-row{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-top:8px}
.attach-icon{font-size:16px;flex-shrink:0}
.attach-name{font-size:12px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.attach-remove{background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;flex-shrink:0}
`;

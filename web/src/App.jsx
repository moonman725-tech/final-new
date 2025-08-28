import React,{useEffect,useMemo,useState} from 'react'
import {api} from './utils/api'
import ItemForm from './components/ItemForm'
import ItemList from './components/ItemList'
import Toolbar from './components/Toolbar'
import AdminPanel from './components/AdminPanel'
import CSVPanel from './components/CSVPanel'
import Dashboard from './components/Dashboard'
import Scan from './components/Scan'
export default function App(){const[tab,setTab]=useState('Home');const[items,setItems]=useState([]);const[suppliers,setSuppliers]=useState([]);const[categories,setCategories]=useState([]);const[search,setSearch]=useState('');const[catFilter,setCatFilter]=useState('All');const[loading,setLoading]=useState(false);const[showDeleted,setShowDeleted]=useState(false);const loadRefs=async()=>{const[s,c]=await Promise.all([api('/api/suppliers'),api('/api/categories')]);setSuppliers(s.map(x=>x.name));setCategories(c.map(x=>x.name))};useEffect(()=>{loadRefs()},[]);const refresh=async()=>{setLoading(true);try{const p=new URLSearchParams();if(tab!=='Home'&&tab!=='Overview'&&tab!=='Deleted'&&tab!=='Admin'&&tab!=='CSV'&&tab!=='Dashboard'&&tab!=='Scan')p.set('supplier',tab);if(showDeleted&&tab==='Deleted')p.set('includeDeleted','true');const data=await api('/api/items?'+p.toString());setItems(data.filter(it=>(tab==='Deleted')?it.deletedAt:!it.deletedAt))}finally{setLoading(false)}};useEffect(()=>{if(!['Home','Admin','CSV','Dashboard','Scan'].includes(tab))refresh()},[tab]);const onAdd=async b=>{await api('/api/items',{method:'POST',body:JSON.stringify(b)});setTab('Overview');await refresh()};const onRemove=async id=>{await api('/api/items/'+id,{method:'DELETE'});await refresh()};const onAdjustQty=async(it,d)=>{await api('/api/items/'+it.id,{method:'PATCH',body:JSON.stringify({quantity:Math.max(0,(it.quantity||0)+d)})});await refresh()};const onSaveInline=async(id,d)=>{await api('/api/items/'+id,{method:'PATCH',body:JSON.stringify(d)});await refresh()};const filtered=useMemo(()=>items.filter(i=>(!search||i.item.toLowerCase().includes(search.toLowerCase()))&&(catFilter==='All'||i.category===catFilter)),[items,search,catFilter]);const totals=useMemo(()=>{const by=suppliers.reduce((a,s)=>({...a,[s]:0}),{});let g=0;for(const i of filtered){const t=i.quantity*i.price;g+=t;if(by[i.supplier]!==undefined)by[i.supplier]+=t}return{bySupplier:by,grand:g}},[filtered,suppliers]);const exportCSV=async()=>{const csv=await api('/api/export'+((tab!=='Overview'&&tab!=='Home')?('?supplier='+encodeURIComponent(tab)):''),{method:'GET'});const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='stock-export.csv';a.click();URL.revokeObjectURL(url)};return(<div className='min-h-screen p-6 max-w-6xl mx-auto'><header className='mb-6'><h1 className='text-3xl font-bold'>Stock Management</h1><p className='text-gray-600'>Home to add items. Overview & supplier tabs for stock take. CSV for import/export. Admin to set passcode.</p></header><nav className='flex flex-wrap gap-2 mb-4'>{['Home','Overview',...suppliers,'Deleted','CSV','Dashboard','Scan','Admin'].map(t=>(<button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-xl border ${tab===t?'bg-black text-white':'bg-white hover:bg-gray-50'}`}>{t}</button>))}{['Home','Admin','CSV','Dashboard','Scan'].includes(tab)?null:<button onClick={refresh} className='ml-auto px-3 py-2 rounded-xl border'>Refresh</button>}</nav>{tab==='Home'&&<section className='mb-6'><ItemForm suppliers={suppliers} categories={categories} onAdd={onAdd}/></section>}{tab!=='Home'&&!['Admin','CSV','Dashboard','Scan'].includes(tab)&&(<><Toolbar search={search} setSearch={setSearch} category={catFilter} setCategory={setCatFilter} categories={categories} onExport={exportCSV}/><div className='ml-auto mb-2 text-sm text-gray-600'>Total: <strong>£{totals.grand.toFixed(2)}</strong></div>{loading?<p>Loading…</p>:<ItemList items={filtered} onRemove={onRemove} onAdjustQty={onAdjustQty} onSaveInline={onSaveInline} categories={categories} suppliers={suppliers}/>}</>)}{tab==='Deleted'&&(<div className='text-sm text-gray-600 mb-2'>Soft-deleted items appear here.</div>)}{tab==='CSV'&&<CSVPanel onImported={refresh}/>} {tab==='Dashboard'&&<Dashboard/>} {tab==='Scan'&&<Scan/>} {tab==='Admin'&&<AdminPanel/>}<footer className='mt-10 text-xs text-gray-500'>Edits require your passcode (ADMIN_KEY) saved in Admin tab. Install as app from browser menu for best tablet experience.</footer></div>) }
// App.jsx (only the table part shown)

<div className="overflow-x-auto">             {/* NEW: lets the table scroll on small screens */}
  <table className="min-w-[720px] w-full table-fixed border-separate border-spacing-0">  {/* NEW */}
    <thead>
      <tr>
        <th className="px-3 py-2 text-left w-[34%]">Item</th>
        <th className="px-3 py-2 text-left w-[18%]">Category</th>
        <th className="px-3 py-2 text-left w-[16%]">Supplier</th>
        <th className="px-3 py-2 text-right w-[10%]">Quantity</th>
        <th className="px-3 py-2 text-right w-[12%]">Unit&nbsp;Price</th>
        <th className="px-3 py-2 text-right w-[12%]">Total</th>
        <th className="px-3 py-2 text-right w-[8%]"></th> {/* actions (Edit) */}
      </tr>
    </thead>

    <tbody>
      {items.map((r) => (
        <tr key={r.id} className="align-top border-t">
          {/* TEXT CELLS wrap (prevents overlap) */}
          <td className="px-3 py-3 break-words">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{r.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full border">{r.category}</span>
            </div>
          </td>
          <td className="px-3 py-3 break-words">{r.category}</td>
          <td className="px-3 py-3 break-words">{r.supplier}</td>

          {/* NUMBERS never wrap */}
          <td className="px-3 py-3 text-right whitespace-nowrap">{r.qty}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">£{Number(r.unitPrice||0).toFixed(2)}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">£{(Number(r.qty||0)*Number(r.unitPrice||0)).toFixed(2)}</td>

          {/* Action button kept separate so it doesn’t crush columns */}
          <td className="px-3 py-3 text-right whitespace-nowrap">
            <button className="border px-3 py-1 rounded-md">Edit</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

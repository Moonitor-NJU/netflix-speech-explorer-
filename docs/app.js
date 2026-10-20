'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString('zh-CN');
const pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'—';
const sum=(rs,k)=>rs.reduce((v,r)=>v+(Number(r[k])||0),0);
const CATS={music:'音乐 / 歌唱',laughter:'笑声',breathing:'呼吸 / 叹气',crying:'哭泣',vocalization:'哼声 / 咳嗽等人声',voice_style:'说话方式',language:'语言描述',sound:'声音事件',speaker_or_other:'说话人 / 其他',other:'其他描述'};
const COLORS=['#8172db','#b5a8eb','#df7b89','#86b9c2','#91a9d1','#baaccd','#8bbbaa','#d1b181','#c5cad6'];
let data,scope='wavs',tagCategory='all',tagPage=0,samplePage=0,filteredSamples=[],filteredTags=[],currentTag=null;
const PAGE_SIZE=25;
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500)}
function download(name,content,type='text/plain'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('已导出 '+name)}
function csv(rows){return '\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
function metric(label,value,note,icon='◫'){return `<div class="metric"><span class="metric-label">${label}</span><span class="metric-icon">${icon}</span><strong>${value}</strong><small>${note}</small></div>`}
function bars(items){let max=Math.max(...items.map(i=>i.n),1);return items.map((i,j)=>`<div class="bar-row"><span class="bar-label" title="${escapeHTML(i.label)}">${escapeHTML(i.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${100*i.n/max}%;background:${i.color||COLORS[j%COLORS.length]}"></div></div><span class="bar-value">${fmt(i.n)}${i.extra?`<small>${escapeHTML(i.extra)}</small>`:''}</span></div>`).join('')}
function histogram(el,items){const max=Math.max(...items.map(i=>i.n),1);$(el).innerHTML='<div class="mini-chart">'+items.map(i=>`<div class="mini-col" title="${escapeHTML(i.label)}: ${fmt(i.n)}"><span class="mini-value">${fmt(i.n)}</span><div class="mini-bar" style="height:${Math.max(1,90*i.n/max)}px"></div><span class="mini-label">${escapeHTML(i.label)}</span></div>`).join('')+'</div>'}
function countBy(rs,key){const m={};rs.forEach(r=>{const k=r[key]??'缺失';m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function scoped(){return data.rows.filter(r=>scope==='all'||r.track===scope)}
function overview(){
 const rs=scoped(),paired=rs.filter(r=>r.srt&&!r.errors.length),dur=sum(rs,'duration'),cues=sum(rs,'cues'),tagged=sum(rs,'tagged_cues');
 $('metrics').innerHTML=metric('音频文件',fmt(rs.length),'文件级数量 · 未按内容去重','▤')+metric('已记录时长合计',fmt(Math.round(dur/3600))+'<span style="font-size:12px;letter-spacing:0"> 小时</span>',`${fmt(rs.filter(r=>r.duration!==null).length)} 个文件有时长 · WAV 文件头`,'◷')+metric('已读字幕条目',fmt(cues),`已读条目中 ${pct(tagged,cues)} 含方括号描述`,'≋')+metric('文件与字幕配对',pct(paired.length,rs.length),`${fmt(rs.length-paired.length)} 个文件需检查`,'◇');
 const groups=[...new Set(data.rows.map(r=>r.group))].sort();$('batch-chart').innerHTML=bars(groups.map(g=>{const rows=rs.filter(r=>r.group===g);return{label:g.replace('netflix_',''),n:rows.length,extra:fmt(rows.filter(r=>r.analyzed).length)+' 已读'}}));
 const cats={};rs.forEach(r=>Object.entries(r.tag_categories).forEach(([k,n])=>cats[k]=(cats[k]||0)+n));$('category-chart').innerHTML=bars(Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,n])=>({label:CATS[k]||k,n})));
 const edges=[0,10,20,40,60,90,Infinity],labels=['<10','10–20','20–40','40–60','60–90','≥90'];histogram('duration-chart',labels.map((label,i)=>({label,n:rs.filter(r=>r.duration!==null&&r.duration/60>=edges[i]&&r.duration/60<edges[i+1]).length})));
 const cueHist={};rs.forEach(r=>Object.entries(r.cue_duration_hist||{}).forEach(([k,n])=>cueHist[k]=(cueHist[k]||0)+n));histogram('cue-chart',['<1s','1–3s','3–6s','6–10s','≥10s'].map(label=>({label,n:cueHist[label]||0})));
 $('insights').innerHTML=`<p class="insight"><b>${pct(sum(rs,'bracket_only'),cues)}</b> 的字幕条目只有描述或无正文，可优先区分非对白候选。</p><p class="insight"><b>${fmt(rs.filter(r=>r.overlap>0).length)} 个文件</b>存在字幕时间重叠，切片前应确认多人对话与对齐。</p><p class="insight">按<b>作品 ID</b>分割训练与评估集；同作品的多集或多音轨需要一起考虑。</p>`;
 const sr=countBy(rs,'sr').filter(([k])=>k!=='缺失').map(([k,n])=>`${k==='缺失'?'无法读取':fmt(k)+' Hz'} (${fmt(n)})`).join(' / '),ch=countBy(rs,'channels').filter(([k])=>k!=='缺失').map(([k,n])=>`${k==='缺失'?'缺失':k+' 声道'} (${fmt(n)})`).join(' / ');
 $('specs').innerHTML=`<div class="spec"><b>${escapeHTML(sr)||'暂无已读文件头'}</b><span>采样率（已读 ${fmt(rs.filter(r=>r.sr!==null).length)} 个头）</span></div><div class="spec"><b>${escapeHTML(ch)}</b><span>声道（已检查文件头）</span></div><div class="spec"><b>${pct(rs.filter(r=>r.title).length,rs.length)}</b><span>源元数据片名覆盖率</span></div><div class="spec"><b>${pct(rs.filter(r=>r.wer!==null).length,rs.length)}</b><span>已记录 WER 比例</span></div>`;
}
function labels(){const occurrences=data.tags.reduce((s,t)=>s+t.count,0);$('label-metrics').innerHTML=metric('不同原始标签',fmt(data.tags.length),'已分析字幕 · 归一化后的字典','⌗')+metric('标签出现次数',fmt(occurrences),'一条字幕可含多个方括号','≋')+metric('带描述字幕',fmt(sum(data.rows,'tagged_cues')),'按字幕条目计数','▤')+metric('仅出现一次的标签',pct(data.tags.filter(t=>t.count===1).length,data.tags.length),'长尾描述 · 建议归一化后使用','◇');$('label-pills').innerHTML=`<button class="pill active" data-cat="all">全部</button>`+Object.entries(CATS).map(([k,v])=>`<button class="pill" data-cat="${k}">${v}</button>`).join('');$('label-pills').addEventListener('click',e=>{if(!e.target.dataset.cat)return;tagCategory=e.target.dataset.cat;tagPage=0;document.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===tagCategory));renderTags()});renderTags()}
function renderTags(){const q=$('tag-search').value.trim().toLowerCase();filteredTags=data.tags.filter(t=>(tagCategory==='all'||t.category===tagCategory)&&t.tag.includes(q));const pages=Math.max(1,Math.ceil(filteredTags.length/PAGE_SIZE));tagPage=Math.min(tagPage,pages-1);const max=data.tags[0]?.count||1;$('tag-count').textContent=`找到 ${fmt(filteredTags.length)} 个标签 · 按出现次数降序`; $('tag-table').innerHTML=filteredTags.slice(tagPage*PAGE_SIZE,(tagPage+1)*PAGE_SIZE).map(t=>`<tr><td class="tag-text"><button class="tag-drill" data-tag="${escapeHTML(t.tag)}">[${escapeHTML(t.tag)}] ↗</button></td><td><span class="small-badge">${CATS[t.category]||t.category}</span></td><td class="numeric">${fmt(t.count)}</td><td><div class="table-meter"><div style="width:${Math.max(1,100*t.count/max)}%"></div></div></td></tr>`).join('')||'<tr><td colspan="4" class="empty">没有匹配标签</td></tr>';$('tag-page').textContent=`${tagPage+1} / ${pages}`;$('tag-prev').disabled=tagPage===0;$('tag-next').disabled=tagPage===pages-1}
function quality(){const rs=data.rows.filter(r=>r.track==='wavs'),wr=rs.filter(r=>r.wer!==null),errors=rs.filter(r=>r.errors.some(e=>e.startsWith('audio_header:'))),missing=rs.filter(r=>!r.srt),issues=rs.filter(r=>r.bad_time||r.out_of_bounds),avg=wr.length?sum(wr,'wer')/wr.length:null;$('quality-metrics').innerHTML=metric('已检查音频头读取失败',fmt(errors.length),`${fmt(rs.filter(r=>r.header_checked||r.sr!==null).length)} 个主目录文件检查过文件头`,'◇')+metric('音频缺配套 SRT',fmt(missing.length),'wavs 主目录的配对检查','▤')+metric('时间异常文件',fmt(issues.length),'无效时间或字幕超出音频长度','◷')+metric('已记录 WER 匹配',pct(wr.length,rs.length),`${fmt(wr.length)} / ${fmt(rs.length)} 个主目录文件`,'≋');const edges=[0,.1,.2,.4,.6,1,Infinity],labels=['<.1','.1–.2','.2–.4','.4–.6','.6–1','≥1'];histogram('wer-chart',labels.map((label,i)=>({label,n:wr.filter(r=>r.wer>=edges[i]&&r.wer<edges[i+1]).length})));$('wer-note').textContent=`已记录 CSV avg_wer 的简单均值：${avg===null?'无数据':avg.toFixed(3)}。未按词数加权，WER 可以大于 1。评分未做全量转存，空值表示未读取或未匹配，不按 0 处理。`;
 const cues=sum(rs,'cues');$('quality-signals').innerHTML=[['重叠字幕条目',fmt(sum(rs,'overlap'))+' / '+pct(sum(rs,'overlap'),cues)],['无效起止时间',fmt(sum(rs,'bad_time'))],['超过音频长度的字幕',fmt(sum(rs,'out_of_bounds'))],['只有描述 / 无对白正文',fmt(sum(rs,'bracket_only'))+' / '+pct(sum(rs,'bracket_only'),cues)],['带歌词符号的字幕',fmt(sum(rs,'lyric_cues'))],['主目录重复文件 ID',fmt(Object.keys(data.duplicate_wav_ids).length)],['有字幕却没有同名 WAV（全部目录）',fmt(data.orphan_srts.length)]].map(([k,v])=>`<div class="quality-signal"><span>${k}</span><b>${v}</b></div>`).join('');$('scp-table').innerHTML=data.scp.map(s=>`<tr><td class="tag-text">${escapeHTML(s.path.replace(data.root+'/',''))}</td><td>${fmt(s.rows)}</td><td>${fmt(s.duplicate_ids)}</td><td>${fmt(s.missing_in_scanned_wavs)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">原始 SCP 核对因 SSH / NFS 阻塞未完成。本页导出的 SCP 由已核对的全量目录索引生成。</td></tr>'}
function initSamples(){const opt=(v,t)=>`<option value="${escapeHTML(v)}">${escapeHTML(t)}</option>`;$('sample-group').innerHTML+= [...new Set(data.rows.map(r=>r.group))].sort().map(g=>opt(g,g)).join('');$('sample-rating').innerHTML+=[...new Set(data.rows.map(r=>r.rating).filter(Boolean))].sort().map(r=>opt(r,r)).join('');$('sample-category').innerHTML+=Object.entries(CATS).map(([k,v])=>opt(k,v)).join('');renderSamples()}
function hasIssue(r){return !r.srt||r.errors.length||r.bad_time||r.out_of_bounds||(r.analyzed&&r.cues===0)}
function renderSamples(){const q=$('sample-search').value.toLowerCase().trim(),track=$('sample-track').value,group=$('sample-group').value,type=$('sample-type').value,rating=$('sample-rating').value,category=$('sample-category').value,min=$('min-duration').value,max=$('max-duration').value,wer=$('max-wer').value,qual=$('sample-quality').value;
 filteredSamples=data.rows.filter(r=>languageFileMatch(r)&&(!q||[r.id,r.title,r.episode_title].some(v=>String(v||'').toLowerCase().includes(q)))&&(track==='all'||r.track===track)&&(group==='all'||r.group===group)&&(type==='all'||(type==='unknown'?!r.type:r.type===type))&&(rating==='all'||r.rating===rating)&&researchCategoryMatch(r,category)&&(min===''||(r.duration!==null&&r.duration>=Number(min)*60))&&(max===''||(r.duration!==null&&r.duration<=Number(max)*60))&&(wer===''||(r.wer!==null&&r.wer<=Number(wer)))&&(qual==='all'||(qual==='paired'?!r.errors.length&&r.srt:qual==='issues'?hasIssue(r):r.analyzed&&!hasIssue(r)&&!r.overlap)));
 if(currentTag!==null){const paths=new Set((data.tag_file_indices?.[currentTag]||[]).map(i=>data.rows[i].path));filteredSamples=filteredSamples.filter(r=>paths.has(r.path))}$('selected-tag').hidden=currentTag===null;if(currentTag!==null)$('selected-tag-text').textContent='当前原始标签：['+currentTag+'] · 基于已分析字幕';const analysis=$('sample-analysis').value;filteredSamples=filteredSamples.filter(r=>analysis==='all'||(analysis==='yes'?r.analyzed:!r.analyzed));const sort=$('sample-sort').value;filteredSamples.sort((a,b)=>sort==='duration-desc'?(b.duration??-1)-(a.duration??-1):sort==='wer-asc'?(a.wer??Infinity)-(b.wer??Infinity):sort==='tags-desc'?b.tagged_cues-a.tagged_cues:a.id.localeCompare(b.id));const pages=Math.max(1,Math.ceil(filteredSamples.length/PAGE_SIZE));samplePage=Math.min(samplePage,pages-1);$('sample-count').textContent=`${fmt(filteredSamples.length)} 个符合条件的文件`;$('sample-summary').textContent=`已记录时长参考合计 ${fmt(Math.round(sum(filteredSamples,'duration')/3600))} 小时 · 字幕 ${fmt(sum(filteredSamples,'cues'))} 条 · 导出包含全部筛选结果`;
 $('sample-table').innerHTML=filteredSamples.slice(samplePage*PAGE_SIZE,(samplePage+1)*PAGE_SIZE).map(r=>`<tr><td><button class="sample-name" data-path="${escapeHTML(r.path)}">${escapeHTML(r.title||r.id)}${r.season!==null?` <span style="color:#8e97a7">S${r.season} E${r.episode}</span>`:''}</button><span class="sample-id">${escapeHTML(r.id)}</span></td><td>${escapeHTML(r.group.replace('netflix_',''))}<br><span class="sample-id">${r.track}</span></td><td class="numeric">${r.duration===null?'—':(r.duration/60).toFixed(1)+' min'}</td><td class="numeric">${!r.srt?'无字幕文件':r.cues===null?'未分析':fmt(r.cues)}</td><td class="numeric">${pct(r.tagged_cues,r.cues)}</td><td class="numeric">${r.wer===null?'—':r.wer.toFixed(3)}</td><td><span class="small-badge ${hasIssue(r)?'issue':r.analyzed?'good':''}">${hasIssue(r)?'需检查':r.analyzed?'已分析':'字幕未分析'}</span></td></tr>`).join('')||'<tr><td colspan="7" class="empty">没有匹配文件，请放宽筛选条件</td></tr>';$('sample-page').textContent=`${samplePage+1} / ${pages}`;$('sample-prev').disabled=samplePage===0;$('sample-next').disabled=samplePage===pages-1}
function detail(path){const r=data.rows.find(r=>r.path===path);if(!r)return;$('detail-title').textContent=r.title||r.id;const fields=[['文件 ID',r.id],['季 / 集',r.season===null?'未提供':`S${r.season} E${r.episode}`],['剧集名称',r.episode_title||'未提供'],['类型',r.type||'未提供'],['分级',r.rating||'未提供'],['年份',r.year??'未提供'],['时长',r.duration===null?'头信息无法读取':(r.duration/60).toFixed(2)+' 分钟'],['时长来源',r.duration_source==='existing_wer_csv'?'已有 CSV 摘要（聚合范围待核对）':r.sr!==null?'WAV 文件头':'未读取'],['采样率 / 声道 / 位深',`${r.sr??'—'} Hz / ${r.channels??'—'} / ${r.bits??'—'} bit`],['字幕条数',!r.srt?'无字幕文件':r.cues===null?'未分析':fmt(r.cues)],['文件 WER（分段均值）',r.wer===null?'无有效评分':r.wer.toFixed(4)],['时间重叠 / 无效 / 超时',!r.srt?'无字幕文件':r.analyzed?`${r.overlap??'—'} / ${r.bad_time??'—'} / ${r.out_of_bounds??'—'}`:'未分析'],['汉字字幕 / 歌词字幕',!r.srt?'无字幕文件':r.analyzed?`${r.han_cues??'—'} / ${r.lyric_cues??'—'}`:'未分析']];
 $('detail-body').innerHTML=`<div class="path-block">${escapeHTML(r.path)}</div><div class="button-row" style="margin-top:10px"><button class="button quiet" id="copy-path">复制服务器路径</button></div><div class="detail-grid">${fields.map(([k,v])=>`<div><label>${k}</label><strong>${escapeHTML(v)}</strong></div>`).join('')}</div><h3>高频原始描述</h3><div class="detail-tags">${Object.entries(r.tags).map(([t,n])=>`<span class="small-badge">[${escapeHTML(t)}] × ${fmt(n)}</span>`).join('')||`<span class="detail-note">${!r.srt?'无同名字幕，不能判断标签':r.analyzed?'未发现方括号描述':'本文件尚未读取字幕'}</span>`}</div><p class="detail-note">展示本文件出现最多的 12 个归一化标签。人物名和语气描述可能混合出现。</p><h3 style="margin-top:25px">描述字幕示例</h3>${r.examples.map(e=>`<div class="example"><time>${e.start.toFixed(3)}s → ${e.end.toFixed(3)}s</time>${escapeHTML(e.text)}</div>`).join('')||`<p class="detail-note">${!r.srt?'没有同名字幕文件':r.analyzed?'无描述字幕示例':'本文件尚未读取字幕'}</p>`}${r.errors.length?`<div class="notice">${r.errors.map(escapeHTML).join('<br>')}</div>`:''}<p class="detail-note">原始音频保留在服务器。已提取的少量候选片段见下方；未提取的文件可复制路径在服务器抽听。</p>${r.counterpart_path?`<h3 style="margin-top:20px">跨目录同名候选（未验证语言 / 对齐）</h3><div class="path-block">${escapeHTML(r.counterpart_path)}</div>`:''}${r.metadata_path?`<div class="path-block" style="margin-top:12px">代表性元数据：${escapeHTML(r.metadata_path)}</div>`:''}`;
 $('copy-path').onclick=async()=>{try{await navigator.clipboard.writeText(r.path);toast('已复制服务器路径')}catch{toast('剪贴板不可用，请选中上方路径复制')}};$('detail').showModal()}
function view(){let id=location.hash.replace('#','')||'overview';if(!['overview','labels','languages','quality','samples','guide'].includes(id))id='overview';document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+id);document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.dataset.view===id));$('breadcrumb').textContent={overview:'数据概览',labels:'标签图谱',languages:'语种与标签体系',quality:'质量检查',samples:'样本浏览器',guide:'使用指南'}[id];window.scrollTo({top:0})}
function events(){$('tag-table').addEventListener('click',e=>{const b=e.target.closest('[data-tag]');if(!b)return;$('reset-filters').click();currentTag=b.dataset.tag;$('sample-track').value='all';samplePage=0;renderSamples();location.hash='search'});$('clear-selected-tag').onclick=()=>{currentTag=null;renderSamples()};window.addEventListener('hashchange',view);document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.scope;document.querySelectorAll('[data-scope]').forEach(x=>x.classList.toggle('active',x.dataset.scope===scope));overview()});$('tag-search').oninput=()=>{tagPage=0;renderTags()};$('tag-prev').onclick=()=>{tagPage--;renderTags()};$('tag-next').onclick=()=>{tagPage++;renderTags()};$('sample-prev').onclick=()=>{samplePage--;renderSamples()};$('sample-next').onclick=()=>{samplePage++;renderSamples()};['sample-search','sample-track','sample-group','sample-type','sample-rating','sample-category','min-duration','max-duration','max-wer','sample-quality','sample-sort','sample-analysis'].forEach(id=>$(id).addEventListener(id==='sample-search'||id.includes('duration')||id==='max-wer'?'input':'change',()=>{samplePage=0;renderSamples()}));$('reset-filters').onclick=()=>{currentTag=null;['sample-search','min-duration','max-duration','max-wer'].forEach(id=>$(id).value='');['sample-group','sample-type','sample-rating','sample-category','sample-quality'].forEach(id=>$(id).value='all');$('sample-analysis').value='all';$('sample-track').value='wavs';$('sample-sort').value='id';samplePage=0;renderSamples()};$('sample-table').onclick=e=>{const b=e.target.closest('[data-path]');if(b)detail(b.dataset.path)};$('close-detail').onclick=()=>$('detail').close();$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close()}});
 $('export-tags').onclick=()=>download('netflix-label-dictionary.csv',csv([['tag','heuristic_category','occurrences'],...data.tags.map(t=>[t.tag,t.category,t.count])]),'text/csv;charset=utf-8');$('export-csv').onclick=()=>{const keys=['id','title','title_id','season','episode','episode_title','type','rating','year','group','track','path','duration','duration_source','header_checked','sr','channels','bits','srt','subtitle_status','cues','tagged_cues','bracket_only','lyric_cues','overlap','bad_time','out_of_bounds','wer','wer_status','wer_median','asr_transcribe_seconds','asr_recorded_duration','asr_cc_total_segments','wer_csv_median','wer_csv_duration_s','wer_source','wer_scored_segments','wer_ref_words','wer_edits','wer_micro','metadata_status','metadata_path','metadata_episode_path','metadata_runtime','metadata_id','boundary_checked','subtitle_span_union_seconds','wer_num_parts','wer_speech_segments','analyzed','han_cues','subtitle_seconds','errors','counterpart_path','manifest_languages','audio_language','audio_language_status','subtitle_script','tag_categories','research_categories','research_parent_categories','tags','selected_tag'];download('netflix-filtered-files.csv',csv([keys.map(k=>k==='tags'?'top_12_tags':k),...filteredSamples.map(r=>keys.map(k=>k==='selected_tag'?currentTag:r[k]!==null&&typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))]),'text/csv;charset=utf-8')};$('export-scp').onclick=()=>{const idCounts={};filteredSamples.forEach(r=>idCounts[r.id]=(idCounts[r.id]||0)+1);download('netflix-filtered-wavs.scp',filteredSamples.map(r=>`${idCounts[r.id]>1?r.group+'_'+r.track+'_'+r.id:r.id} ${r.path}`).join('\n')+'\n')};$('download-json').onclick=()=>download('netflix-dataset-statistics.json',JSON.stringify(data),'application/json');}
async function init(){try{const inlineData=$('dataset-inline');if(inlineData){data=JSON.parse(inlineData.textContent)}else{const response=await fetch('data.json',{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();if(data.snapshot_parts){const parts=await Promise.all(data.snapshot_parts.map(async name=>{const part=await fetch(name,{cache:'no-cache'});if(!part.ok)throw Error(name+' HTTP '+part.status);return part.text()}));data=JSON.parse(parts.join(''))}};if(data.partial){$('scan-banner').hidden=false;$('scan-banner').textContent='扫描进行中：已完成 '+fmt(data.rows.length)+' / '+fmt(data.planned_files)+' 个文件。以下仅展示已完成文件的统计，不代表全量结果。'}if(data.sample_mode){$('scan-banner').hidden=false;$('scan-banner').textContent='分析范围：全量文件清单 '+fmt(data.rows.length)+' 个；已分析文件 '+fmt(data.rows.filter(r=>r.analyzed).length)+' 个。字幕与标签统计来自分批次/分目录抽样及此前已读文件，不代表全库分布估计。'}if(data.subtitle_scope_complete){$('scan-banner').hidden=false;$('scan-banner').textContent='字幕分析完成：已核对 '+fmt(data.rows.length)+' 个 WAV；读取 '+fmt(data.subtitle_files_read)+' 个配对 SRT 的全部条目；'+fmt(data.subtitle_files_missing)+' 个 WAV 缺少同名字幕。音频信号、文件头、元数据与 WER 的检查范围另见各项说明。'}const dt=new Date(data.generated_at),date=dt.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});$('scan-date').textContent='更新于 '+date;$('footer-stamp').textContent='服务器扫描 · '+date;$('method-date').textContent=`统计时间：${date}（UTC+8）。服务器：${data.host}。本页面是只读快照，不自动连接服务器。`;$('loading').hidden=true;$('app').hidden=false;overview();labels();quality();initSamples();events();view();const heights=[7,10,15,24,18,30,48,62,41,72,90,61,48,69,85,94,66,47,76,58,39,52,30,44,26,17,22,13,9,7];document.querySelector('.waveform').innerHTML=heights.map(h=>`<i style="height:${h}px"></i>`).join('')}catch(e){$('loading').hidden=true;$('error').hidden=false;$('error').textContent='统计快照加载失败。请通过 HTTP 服务打开此页面，并确认 data.json 已生成。'+e.message}}
/* COMPLETE_STATISTICS_UI_START */
const WER_REASONS={valid:'有有效文件评分',no_source_record:'来源中无对应评估',no_scorable_segments:'没有可评分分段',aggregate_without_exact_path:'仅有多部分汇总',ambiguous_or_invalid_record:'匹配歧义 / 分数无效',conflicting_records:'评估记录冲突'};
const META_REASONS={matched:'源元数据已匹配',matched_episode_missing:'作品已匹配，对应季集字段缺失',no_source_metadata:'未找到该作品的源元数据',read_error:'源元数据未能解析'};
const baseOverview=overview;
overview=function(){
 baseOverview();const s=data.statistics;if(!s)return;
 $('statistics-coverage').hidden=false;
 $('coverage-body').innerHTML=s.coverage.map(c=>`<tr><td><b>${escapeHTML(c.scope)}</b></td><td>${fmt(c.files)}</td><td>${fmt(c.subtitle_files)}<small class="coverage-extra">缺 ${fmt(c.missing_subtitles)}</small></td><td>${fmt(c.headers_attempted)}<small class="coverage-extra">成功 ${fmt(c.headers_valid)}</small></td><td>${fmt(c.duration_files)}</td><td>${fmt(c.metadata_files)}</td><td>${fmt(c.wer_files)}<small class="coverage-extra">无评分 ${fmt(c.wer_missing)}</small></td></tr>`).join('');
 $('coverage-status').textContent=s.complete?'已完成来源普查':'来源普查尚未结束';
 $('scan-banner').hidden=false;
 $('scan-banner').textContent=`${s.complete?'来源统计已完成':'来源统计进行中'}：${fmt(data.rows.length)} 个 WAV；${fmt(data.subtitle_files_read)} 个可用字幕已读；各项有效值、缺失和异常单独计数。WER 缺失不按 0 处理，音频内容未做完整解码。`;
};
const baseQuality=quality;
quality=function(){
 baseQuality();const s=data.statistics;if(!s)return;
 const rs=data.rows,wr=rs.filter(r=>r.wer!==null),missing=rs.length-wr.length,validHeads=rs.filter(r=>r.header_status==='valid').length;
 $('quality-metrics').innerHTML=metric('音频头已检查',fmt(rs.filter(r=>r.header_checked).length),`共 ${fmt(rs.length)} 个；成功 ${fmt(validHeads)}，异常 ${fmt(rs.filter(r=>r.header_status==='error').length)}`,'◇')+metric('缺少同名字幕',fmt(rs.filter(r=>!r.srt).length),`全部 ${fmt(rs.length)} 个 WAV 的配对核对`,'▤')+metric('时间异常文件',fmt(rs.filter(r=>r.bad_time||r.out_of_bounds).length),`已复核音频边界 ${fmt(rs.filter(r=>r.boundary_checked).length)} 个配对文件`,'◷')+metric('有文件 WER',fmt(wr.length),`共 ${fmt(rs.length)} 个；${fmt(missing)} 个无评分`,'≋');
 $('wer-title').textContent='有评分文件的 WER 分布';
 $('wer-caption').textContent=`柱子合计 ${fmt(wr.length)} 个文件；另有 ${fmt(missing)} 个无评分文件，不计入这些区间。`;
 const edges=[0,.1,.2,.4,.6,1,Infinity],labels=['<0.1','0.1–0.2','0.2–0.4','0.4–0.6','0.6–1','≥1'];
 histogram('wer-chart',labels.map((label,i)=>({label,n:wr.filter(r=>r.wer>=edges[i]&&r.wer<edges[i+1]).length})));
 $('wer-note').textContent=`全部 ${fmt(rs.length)} = 有评分 ${fmt(wr.length)} + 无评分 ${fmt(missing)}。文件分数优先来自精确 wav_path 的 JSONL 分段均值；CSV 仅用于唯一文件的单部分补充。文件分数简单均值 ${wr.length?(sum(wr,'wer')/wr.length).toFixed(4):'—'}，不等于按词加权 WER。`;
 $('wer-coverage-total').textContent=`${fmt(rs.length)} 个文件 = ${fmt(wr.length)} 个有评分 + ${fmt(missing)} 个无评分`;
 $('wer-coverage-bar').innerHTML=`<span style="width:${100*wr.length/rs.length}%" title="有评分 ${fmt(wr.length)}"></span><i style="width:${100*missing/rs.length}%" title="无评分 ${fmt(missing)}"></i>`;
 $('wer-reasons').innerHTML=bars(Object.entries(s.wer_reasons).map(([key,n])=>({label:WER_REASONS[key]||key,n,color:key==='valid'?'#8172db':'#aeb5c3'})));
 const c=s.assessed_segment_counts,bytes=s.jsonl_files.reduce((v,f)=>v+f.bytes,0);
 $('assessment-metrics').innerHTML=metric('CSV 来源记录',fmt(s.csv_records),`${fmt(s.csv_sources.length)} 份 CSV，已完整读取`,'▤')+metric('逐段评估记录',fmt(s.jsonl_records),`${fmt(s.jsonl_files.length)} 份 JSONL / ${(bytes/1024**3).toFixed(2)} GiB`,'≋')+metric('参考词加权 WER',s.micro_wer===null?'—':(100*s.micro_wer).toFixed(2)+'%',`${fmt(c.segments_with_edit_counts)} 段有可用编辑计数`,'◇')+metric('历史任务未匹配',fmt(s.jsonl_unmatched_jobs),'这些任务不在当前 WAV 清单中','↗');
 $('assessment-note').textContent=`当前文件对应 ${fmt(c.segments)} 个评估分段，其中 ${fmt(c.scored_segments)} 段有分数、${fmt(c.unscored_segments)} 段无分数；参考词 ${fmt(c.ref_words)}。按词加权 WER=(替换+删除+插入)/参考词数，只覆盖有编辑计数的分段。重复任务 ${fmt(s.jsonl_duplicate_jobs)}，冲突任务 ${fmt(s.jsonl_conflicting_jobs)}。`;
 $('quality-signals').innerHTML=[['重叠字幕条目',fmt(sum(rs,'overlap'))],['无效起止时间',fmt(sum(rs,'bad_time'))],['超过已知音频长度的字幕',fmt(sum(rs,'out_of_bounds'))],['只有描述 / 无对白正文',fmt(sum(rs,'bracket_only'))],['带歌词符号的字幕',fmt(sum(rs,'lyric_cues'))],['去重叠后的字幕覆盖',fmt(Math.round(sum(rs,'subtitle_span_union_seconds')/3600))+' 小时（含声音描述）'],['孤立 SRT（全部目录）',fmt(data.orphan_srts.length)]].map(([k,v])=>`<div class="quality-signal"><span>${k}</span><b>${v}</b></div>`).join('');
};
const baseDetail=detail;
detail=function(path){baseDetail(path);const r=data.rows.find(r=>r.path===path);if(!r||!data.statistics)return;$('detail-body').insertAdjacentHTML('beforeend',`<h3 style="margin-top:24px">评分与统计来源</h3><div class="detail-grid"><div><label>WER 状态</label><strong>${escapeHTML(WER_REASONS[r.wer_status]||r.wer_status)}</strong></div><div><label>评分来源</label><strong>${escapeHTML(r.wer_source||'完整来源中未找到有效文件评分')}</strong></div><div><label>参考词数 / 编辑数</label><strong>${r.wer_ref_words===null?'—':fmt(r.wer_ref_words)+' / '+fmt(r.wer_edits)}</strong></div><div><label>文件按词加权 WER</label><strong>${r.wer_micro===null?'—':r.wer_micro.toFixed(4)}</strong></div><div><label>元数据状态</label><strong>${escapeHTML(META_REASONS[r.metadata_status]||r.metadata_status)}</strong></div><div><label>字幕与音频边界</label><strong>${r.boundary_checked?'已按 WAV 文件头时长复核':r.srt?'缺少有效音频时长':'无同名字幕'}</strong></div></div>`);};
/* COMPLETE_STATISTICS_UI_END */





/* RESEARCH_UI_START */
let taxonomyParent='all',taxonomyLeaf='all',listenParent='nvv',listenLeaf='laughter',listenExact=null,taxonomySummary=null;
function taxLeafLabel(k){return data.taxonomy.leaves[k]?.label||k}
function taxPath(k){const s=data.taxonomy.leaves[k];return s?data.taxonomy.parents[s.parent].label+' → '+s.label:k}
function taxCounts(parent,leaf){if(!taxonomySummary){taxonomySummary={parents:{},leaves:{},all:{labels:data.tags.length,count:0}};const add=(obj,k,n)=>{obj[k]??={labels:0,count:0};obj[k].labels++;obj[k].count+=n};for(const t of data.tags){taxonomySummary.all.count+=t.count;const parents=new Set();for(const k of t.taxonomy){add(taxonomySummary.leaves,k,t.count);parents.add(data.taxonomy.leaves[k].parent)}for(const p of parents)add(taxonomySummary.parents,p,t.count)}}return(leaf?taxonomySummary.leaves[leaf]:parent==='all'?taxonomySummary.all:taxonomySummary.parents[parent])||{labels:0,count:0}}
function taxonomyNav(){
 const parents=data.taxonomy.parents,leaves=data.taxonomy.leaves;
 $('label-pills').innerHTML=`<div class="taxonomy-level"><span class="taxonomy-caption">一级 · 大类</span><div class="taxonomy-buttons"><button class="pill ${taxonomyParent==='all'?'active':''}" data-parent="all">全部 <small>${fmt(data.tags.length)}</small></button>${Object.entries(parents).map(([k,v])=>`<button class="pill ${taxonomyParent===k?'active':''}" data-parent="${k}">${escapeHTML(v.label)} <small>${fmt(taxCounts(k).labels)}</small></button>`).join('')}</div></div><div class="taxonomy-level"><span class="taxonomy-caption">二级 · 小类</span><div class="taxonomy-buttons"><button class="pill ${taxonomyLeaf==='all'?'active':''}" data-leaf="all">全部小类</button>${Object.entries(leaves).filter(([k,v])=>taxonomyParent==='all'||v.parent===taxonomyParent).map(([k,v])=>`<button class="pill ${taxonomyLeaf===k?'active':''}" data-leaf="${k}">${escapeHTML(v.label)} <small>${fmt(taxCounts(null,k).labels)}</small></button>`).join('')}</div></div><p class="footnote">${escapeHTML(parents[taxonomyParent]?.description||'先选大类，再选小类，最后查看字幕中的原始描述。')} 数字为命中的不同原始描述数；复合描述可属于多个类别。</p>`;
}
labels=function(){
 const occurrences=data.tags.reduce((s,t)=>s+t.count,0);
 $('label-metrics').innerHTML=metric('原始描述',fmt(data.tags.length),'全部已读字幕 · 归一化字典','⌗')+metric('描述出现次数',fmt(occurrences),'按原始描述计数，不重复汇总小类','≋')+metric('研究大类 / 小类',Object.keys(data.taxonomy.parents).length+' / '+Object.keys(data.taxonomy.leaves).length,'规则多标签归类 · 可复核','▤')+metric('单事件短试听',fmt((data.audio_examples||[]).length),'长情境与语种复核样例另列','▷');
 taxonomyNav();
 $('label-pills').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.parent!==undefined){taxonomyParent=b.dataset.parent;taxonomyLeaf='all'}else if(b.dataset.leaf!==undefined)taxonomyLeaf=b.dataset.leaf;else return;tagPage=0;taxonomyNav();renderTags()};
 renderTags();
};
renderTags=function(){
 const q=$('tag-search').value.trim().toLowerCase();
 filteredTags=data.tags.filter(t=>t.tag.includes(q)&&(taxonomyParent==='all'||t.taxonomy.some(k=>data.taxonomy.leaves[k].parent===taxonomyParent))&&(taxonomyLeaf==='all'||t.taxonomy.includes(taxonomyLeaf)));
 const pages=Math.max(1,Math.ceil(filteredTags.length/PAGE_SIZE));tagPage=Math.min(tagPage,pages-1);const max=data.tags[0]?.count||1;
 $('tag-count').textContent=`${taxonomyParent==='all'?'全部大类':data.taxonomy.parents[taxonomyParent].label}${taxonomyLeaf==='all'?'':' → '+taxLeafLabel(taxonomyLeaf)} · ${fmt(filteredTags.length)} 个原始描述 · 类别可交叉`;
 const available=new Set((data.audio_examples||[]).map(c=>c.leaf));
 $('tag-table').innerHTML=filteredTags.slice(tagPage*PAGE_SIZE,(tagPage+1)*PAGE_SIZE).map(t=>`<tr><td class="tag-text"><button class="tag-drill" data-tag="${escapeHTML(t.tag)}">[${escapeHTML(t.tag)}] ↗</button></td><td><div class="tax-badges">${t.taxonomy.map(k=>`<span class="small-badge" title="${escapeHTML(taxPath(k))}">${escapeHTML(taxPath(k))}</span>`).join('')}</div>${t.taxonomy.some(k=>available.has(k))?`<button class="listen-link" data-listen-leaf="${t.taxonomy.find(k=>available.has(k))}">▷ 听小类候选</button>`:''}</td><td class="numeric">${fmt(t.count)}</td><td><div class="table-meter"><div style="width:${Math.max(1,100*t.count/max)}%"></div></div></td></tr>`).join('')||'<tr><td colspan="4" class="empty">没有匹配描述</td></tr>';
 $('tag-page').textContent=`${tagPage+1} / ${pages}`;$('tag-prev').disabled=tagPage===0;$('tag-next').disabled=tagPage===pages-1;
};
function clipTime(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=(s%60).toFixed(2).padStart(5,'0');return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+sec}
function clipSrc(c){return typeof OFFLINE_AUDIO==='undefined'?c.src:(OFFLINE_AUDIO[c.src]||c.src)}
function clipCard(c){return `<article class="clip-card"><div class="clip-heading"><span class="small-badge">${escapeHTML(taxLeafLabel(c.leaf))}</span><span>${(c.clip_end-c.clip_start).toFixed(2)} 秒 · 16 kHz</span></div><h4>[${escapeHTML(c.tag)}]</h4><p class="clip-subtitle">${escapeHTML(c.subtitle)}</p><audio controls preload="none" aria-label="${escapeHTML(taxLeafLabel(c.leaf)+'，'+c.title+'，'+c.id)}" src="${escapeHTML(clipSrc(c))}"></audio><p class="audio-error" hidden>音频加载失败，请刷新后重试。</p><div class="clip-source"><b>${escapeHTML(c.title)}</b><span>${escapeHTML(c.id)} · ${escapeHTML(c.group.replace('netflix_',''))} · ${escapeHTML(c.track)}</span><span>字幕 ${clipTime(c.cue_start)}–${clipTime(c.cue_end)}<br>切片 ${clipTime(c.clip_start)}–${clipTime(c.clip_end)}</span></div><details><summary>查看原始路径与切片依据</summary><div class="path-block">${escapeHTML(c.path)}</div><p>原始 PCM WAV 按字幕定位截取；前留 0.3 秒、后留 0.4 秒，边界处截断。未做降噪、归一化或语音合成。</p><p>字幕候选 · 尚未人工听审；可能包含对白、配乐、多人声或对齐误差。只提供少量参考，不代表小类的完整分布。</p><code>SHA-256: ${escapeHTML(c.sha256)}</code></details><button class="listen-link" data-clip-file="${escapeHTML(c.path)}">查看整文件详情 ↗</button></article>`}
function renderListening(){
 const clips=data.audio_examples||[],parents=data.taxonomy.parents;
 $('listen-library-summary').textContent=`试听库共 ${clips.length} 段 · ${new Set(clips.map(c=>c.leaf)).size} 个小类 · ${new Set(clips.map(c=>c.group)).size} 个数据批次 · 每段保留来源与时间戳`;
 $('listen-parents').innerHTML=Object.entries(parents).map(([k,v])=>{const n=clips.filter(c=>data.taxonomy.leaves[c.leaf].parent===k).length;return `<button class="pill ${listenParent===k?'active':''}" data-listen-parent="${k}">${escapeHTML(v.label)} <small>${n} 段</small></button>`}).join('');
 const leaves=Object.entries(data.taxonomy.leaves).filter(([k,v])=>v.parent===listenParent);
 $('listen-leaves').innerHTML=leaves.map(([k,v])=>`<button class="pill ${listenLeaf===k?'active':''}" data-listen-sub="${k}">${escapeHTML(v.label)} <small>${clips.filter(c=>c.leaf===k).length}</small></button>`).join('');
 const selected=clips.filter(c=>listenExact!==null?c.tag===listenExact:c.leaf===listenLeaf);
 $('listen-summary').textContent=listenExact!==null?`原始描述 [${listenExact}]：${selected.length} 段已提取试听。`:`${taxPath(listenLeaf)} · ${selected.length} 段候选 · 尽量来自不同作品`;
 $('listen-clear').hidden=listenExact===null;
 $('listen-grid').innerHTML=selected.map(clipCard).join('')||`<div class="empty">${listenExact!==null?'该原始描述尚未提取试听。点击“浏览小类试听”选择现有候选；下方整文件列表仍按该原始描述筛选。':'该小类尚无已提取候选。可切换其他小类；未提取不代表数据集中没有此事件。'}</div>`;
 $('listen-grid').querySelectorAll('audio').forEach(a=>{a.addEventListener('error',()=>{a.parentElement.querySelector('.audio-error').hidden=false});a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause()}))});
}
const researchBaseInitSamples=initSamples;
initSamples=function(){researchBaseInitSamples();$('sample-category').innerHTML='<option value="all">不限标签</option>'+Object.entries(data.taxonomy.parents).map(([p,v])=>`<optgroup label="${escapeHTML(v.label)}"><option value="parent:${p}">${escapeHTML(v.label)} · 全部</option>${Object.entries(data.taxonomy.leaves).filter(([k,s])=>s.parent===p).map(([k,s])=>`<option value="leaf:${k}">${escapeHTML(s.label)}</option>`).join('')}</optgroup>`).join('');renderListening()};
function researchCategoryMatch(r,value){if(value==='all')return true;const [level,key]=value.split(':');if(level==='leaf')return(r.research_categories?.[key]||0)>0;if(level==='parent')return Object.keys(r.research_categories||{}).some(k=>data.taxonomy.leaves[k]?.parent===key);return(r.tag_categories[value]||0)>0}
const researchBaseRenderSamples=renderSamples;
renderSamples=function(){researchBaseRenderSamples();if(listenExact!==currentTag){listenExact=currentTag;if(currentTag!==null){const clip=(data.audio_examples||[]).find(c=>c.tag===currentTag),raw=data.tags.find(t=>t.tag===currentTag);listenLeaf=clip?.leaf||raw?.taxonomy?.[0]||listenLeaf;listenParent=data.taxonomy.leaves[listenLeaf].parent}renderListening()}};
const researchBaseDetail=detail;
detail=function(path){researchBaseDetail(path);const clips=(data.audio_examples||[]).filter(c=>c.path===path);$('detail-body').insertAdjacentHTML('beforeend',`<h3>本文件已提取试听</h3>${clips.length?`<div class="listening-grid">${clips.map(clipCard).join('')}</div>`:'<p class="detail-note">本文件暂无单事件短片段；长情境样本另列，原始音频保留在服务器。</p>'}`);$('detail-body').querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})))};
const researchBaseEvents=events;
events=function(){researchBaseEvents();
 $('copy-share-link').onclick=async()=>{const url=location.origin+location.pathname+location.hash;try{await navigator.clipboard.writeText(url);toast('已复制当前页面链接')}catch{window.prompt('复制页面链接',url)}};
 $('export-tags').onclick=()=>download('netflix-research-label-dictionary.csv',csv([['raw_normalized_tag','occurrences','research_taxonomy_paths','taxonomy_leaf_ids','legacy_category','taxonomy_version'],...data.tags.map(t=>[t.tag,t.count,t.taxonomy.map(taxPath).join(' | '),t.taxonomy.join('|'),t.category,data.taxonomy.version])]),'text/csv;charset=utf-8');
 $('export-taxonomy').onclick=()=>download('netflix-research-taxonomy.json',JSON.stringify(data.taxonomy,null,2),'application/json');
 $('export-clips').onclick=()=>download('netflix-audio-example-provenance.json',JSON.stringify(data.audio_examples,null,2),'application/json');
 $('listen-parents').onclick=e=>{const b=e.target.closest('[data-listen-parent]');if(!b)return;listenParent=b.dataset.listenParent;listenLeaf=Object.keys(data.taxonomy.leaves).find(k=>data.taxonomy.leaves[k].parent===listenParent);listenExact=null;renderListening()};
 $('listen-leaves').onclick=e=>{const b=e.target.closest('[data-listen-sub]');if(!b)return;listenLeaf=b.dataset.listenSub;listenExact=null;renderListening()};
 $('listen-clear').onclick=()=>{listenExact=null;renderListening()};
 $('tag-table').addEventListener('click',e=>{const b=e.target.closest('[data-listen-leaf]');if(!b)return;listenLeaf=b.dataset.listenLeaf;listenParent=data.taxonomy.leaves[listenLeaf].parent;listenExact=null;renderListening();location.hash='listen';$('listening-library').scrollIntoView({behavior:'smooth',block:'start'})});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-clip-file]');if(b)detail(b.dataset.clipFile)});
 $('close-detail').addEventListener('click',()=>$('detail').querySelectorAll('audio').forEach(a=>a.pause()));
 $('detail').addEventListener('close',()=>$('detail').querySelectorAll('audio').forEach(a=>a.pause()));
};
/* RESEARCH_UI_END */

/* LANGUAGE_CONTEXT_UI_START */
let listenMode='short',listenAudioLanguage='all',listenWriting='all',listenPage=0;
const LANGUAGE_NAMES={zh:'中文',en:'英语',ja:'日语',ko:'韩语',es:'西班牙语',fr:'法语',de:'德语',it:'意大利语',pt:'葡萄牙语',ru:'俄语',ar:'阿拉伯语',hi:'印地语',th:'泰语',vi:'越南语',ta:'泰米尔语',te:'泰卢固语'};
const WRITING_NAMES={han:'汉字型标签',latin:'拉丁字母型标签',mixed:'汉字与拉丁字母混合',han_latin_mixed:'汉字与拉丁字母混合',kana_or_mixed:'含假名的标签',other:'其他文字'};
function audioLanguageText(c){return c.audio_language_status==='consistent_candidate'?(LANGUAGE_NAMES[c.audio_language]||c.audio_language)+'候选':c.audio_language_status==='mixed_or_conflict'?'混合／冲突候选':c.audio_language_status==='not_run'?'尚未抽查':'语种证据不足'}
function libraryClips(){return listenMode==='context'?(data.context_examples||[]):(data.audio_examples||[])}
function clipLeaves(c){return listenMode==='context'?c.taxonomy:[c.leaf]}
function clipWriting(c){return c.label_script||(/[\u4e00-\u9fff]/.test(c.tag||'')?'han':'latin')}
function audioMatches(c,v){if(v==='all')return true;if(v==='unknown')return !c.audio_language;if(v==='other')return Boolean(c.audio_language&&!['zh','en'].includes(c.audio_language));return c.audio_language===v}
function contextCard(c){return `<article class="clip-card context-card"><div class="clip-heading"><span class="small-badge">多标签情境 · ${(c.clip_end-c.clip_start).toFixed(0)} 秒</span><span>${c.taxonomy.length} 个小类 · ${c.tags.length} 种原始描述</span></div><h4>${escapeHTML(c.title)}</h4><div class="context-tags">${c.taxonomy.map(k=>`<span class="small-badge">${escapeHTML(taxLeafLabel(k))}</span>`).join('')}</div><p class="clip-subtitle">源文件抽查：${escapeHTML(audioLanguageText(c))} · ${escapeHTML(WRITING_NAMES[c.label_script]||'混合标签')}。本段未单独做纯语种认证。</p><audio controls preload="none" src="${escapeHTML(clipSrc(c))}" aria-label="情境样本，${escapeHTML(c.id)}"></audio><p class="audio-error" hidden>音频加载失败，请刷新后重试。</p><p class="clip-source">${escapeHTML(c.group)} / ${escapeHTML(c.track)} · ${clipTime(c.clip_start)}–${clipTime(c.clip_end)}</p><div class="context-timeline" aria-label="带标签的字幕时间线">${c.cues.map(q=>`<div class="context-cue ${q.tags.length?'has-tags':''}"><button class="cue-seek" data-seek="${q.relative_start}">${clipTime(q.relative_start)}</button><div>${escapeHTML(q.text).replace(/\[([^\]]+)\]/g,'<mark>[$1]</mark>')}${q.taxonomy.length?`<small>${q.taxonomy.map(taxLeafLabel).map(escapeHTML).join(' · ')}</small>`:''}</div></div>`).join('')}</div><details><summary>来源与选择方法</summary><div class="path-block">${escapeHTML(c.path)}</div><p>选取约60秒内标签多样性较高的窗口；不是随机抽样。一段可跨多个小类，因此类别计数可以重叠。未做降噪、变速或音量归一化，尚未人工核验标签与声音的对应。</p><code>SHA-256: ${escapeHTML(c.sha256)}</code></details><button class="listen-link" data-clip-file="${escapeHTML(c.path)}">查看整文件详情 ↗</button></article>`}
const languageClipCard=clipCard;
clipCard=function(c){return languageClipCard(c).replace('<div class="clip-source">',`<p class="clip-language">源文件抽查：${escapeHTML(audioLanguageText(c))} · ${escapeHTML(WRITING_NAMES[c.label_script]||'标签文字未分类')}</p><div class="clip-source">`)};
renderListening=function(){
 const clips=libraryClips(),parents=data.taxonomy.parents,leaves=data.taxonomy.leaves;
 $('listen-library-summary').textContent=`单事件短片段 ${(data.audio_examples||[]).length} 段 · 多标签情境 ${(data.context_examples||[]).length} 段；音频语种与标签文字分别筛选，均保留来源。`;
 $('listening-modes').innerHTML=`<button class="mode-button ${listenMode==='short'?'active':''}" data-listen-mode="short">单事件短片段</button><button class="mode-button ${listenMode==='context'?'active':''}" data-listen-mode="context">多标签情境 · 约60秒</button><a class="button quiet" href="#languages">语种核验与中英文标签说明 ↗</a>`;
 $('listen-parents').innerHTML=Object.entries(parents).map(([p,v])=>`<button class="pill ${listenParent===p?'active':''}" data-listen-parent="${p}">${escapeHTML(v.label)} <small>${clips.filter(c=>clipLeaves(c).some(k=>leaves[k]?.parent===p)).length} 段</small></button>`).join('');
 const options=Object.entries(leaves).filter(([k,v])=>v.parent===listenParent);
 $('listen-leaves').innerHTML=`<label>二级分类<select id="listen-subcategory"><option value="all" ${listenLeaf==='all'?'selected':''}>当前大类 · 全部小类</option>${options.map(([k,v])=>{const n=clips.filter(c=>clipLeaves(c).includes(k)).length;return `<option value="${k}" ${listenLeaf===k?'selected':''}>${escapeHTML(v.label)} · ${n} 段${n?'':'（待补充）'}</option>`}).join('')}</select></label><label>源文件音频语种（模型抽查）<select id="listen-audio-language">${[['all','全部语种'],['zh','中文候选'],['en','英语候选'],['other','其他语种候选'],['unknown','混合／证据不足／未查']].map(([k,v])=>`<option value="${k}" ${listenAudioLanguage===k?'selected':''}>${v}</option>`).join('')}</select></label><label>原始标签文字<select id="listen-writing">${[['all','全部文字'],['han','汉字型'],['latin','拉丁字母型'],['mixed','汉字与拉丁字母混合']].map(([k,v])=>`<option value="${k}" ${listenWriting===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="classification-help">${escapeHTML(parents[listenParent].description)}<br>先选大类，再选相关小类；“音频说什么语言”和“标签用什么文字”是两个独立维度。</p>`;
 let selected=clips.filter(c=>(listenExact!==null?(listenMode==='context'?c.tags.includes(listenExact):c.tag===listenExact):clipLeaves(c).some(k=>leaves[k]?.parent===listenParent)&&(listenLeaf==='all'||clipLeaves(c).includes(listenLeaf)))&&audioMatches(c,listenAudioLanguage)&&(listenWriting==='all'||clipWriting(c)===listenWriting));
 const pages=Math.max(1,Math.ceil(selected.length/6));listenPage=Math.max(0,Math.min(listenPage,pages-1));
 $('listen-summary').textContent=(listenExact!==null?`原始描述 [${listenExact}]`:parents[listenParent].label+' → '+(listenLeaf==='all'?'全部小类':taxLeafLabel(listenLeaf)))+` · ${selected.length} 段符合条件${listenMode==='context'?' · 一段可含多个类别':''}`;
 $('listen-clear').hidden=listenExact===null;
 $('listen-grid').innerHTML=selected.slice(listenPage*6,(listenPage+1)*6).map(c=>listenMode==='context'?contextCard(c):clipCard(c)).join('')||'<div class="empty">暂无符合这些条件的已提取样例。请放宽语种、标签文字或小类筛选；这不表示原数据中没有对应事件。</div>';
 $('listen-page').textContent=`${listenPage+1} / ${pages}`;$('listen-prev').disabled=listenPage===0;$('listen-next').disabled=listenPage===pages-1;
 $('listen-subcategory').onchange=e=>{listenLeaf=e.target.value;listenExact=null;listenPage=0;renderListening()};
 $('listen-audio-language').onchange=e=>{listenAudioLanguage=e.target.value;listenPage=0;renderListening()};
 $('listen-writing').onchange=e=>{listenWriting=e.target.value;listenPage=0;renderListening()};
 $('listen-grid').querySelectorAll('audio').forEach(a=>{a.addEventListener('error',()=>{a.parentElement.querySelector('.audio-error').hidden=false});a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()}))});
};
function languageView(){const s=data.language_audit;if(!s)return;
 $('language-metrics').innerHTML=metric('音频文件',fmt(s.total_files),'逐文件索引','▤')+metric('实际音频已抽查',fmt(s.audio_checked),s.complete?'每文件三个独立窗口':'仍有文件未完成，不能按已查结果外推','◷')+metric('主目录 zh 清单',fmt(s.stats.find(x=>x.track==='wavs')?.manifest_zh),'原始清单声明，独立于 wavs_zh 目录','◇')+metric('语言证据维度','4','目录 / 清单 / 字幕文字 / 实际音频','⌗');
 $('language-method').textContent=`${s.complete?'逐文件抽查已完成':'抽查尚未完成'}。${s.scope}。模型 ${s.model?.model||'待运行'}；每个文件在约20%、50%、80%位置各取8秒，至少2个有效窗口一致才给出语种候选。高置信度不等于整片纯语种认证。`;
 $('language-coverage').innerHTML=s.stats.map(x=>{const a=x.audio_results,other=Object.entries(a).filter(([k])=>!['zh','en','mixed_or_conflict','insufficient_evidence','read_error','not_run'].includes(k)).reduce((n,[k,v])=>n+v,0);return `<tr><td><b>${x.track}</b></td><td>${fmt(x.files)}</td><td>${fmt(x.manifest_zh)}</td><td>${fmt(x.subtitle_scripts.han_majority||0)}</td><td>${fmt(x.audio_checked)}</td><td>${fmt(a.zh||0)}</td><td>${fmt(a.en||0)}</td><td>${fmt(other)}</td><td>${fmt((a.mixed_or_conflict||0)+(a.insufficient_evidence||0)+(a.read_error||0)+(a.not_run||0))}</td></tr>`}).join('');
 $('language-limitations').innerHTML=s.limitations.map(x=>`<li>${escapeHTML(x)}</li>`).join('');
 $('language-exceptions').innerHTML=[...s.counterexamples.filter(c=>c.track==='wavs_zh').slice(0,6),...s.counterexamples.filter(c=>c.track==='wavs').slice(0,6)].map(c=>`<tr><td><button class="sample-name" data-clip-file="${escapeHTML(c.path)}">${escapeHTML(c.title)}</button><span class="sample-id">${escapeHTML(c.id)}</span></td><td>${c.track}</td><td>${escapeHTML(LANGUAGE_NAMES[c.language]||c.language)}候选</td><td>${c.subtitle_script==='han_majority'?'汉字字幕为主':c.subtitle_script==='empty_or_unparsed'?'空字幕':'非汉字字幕为主'}</td><td>${c.windows.filter(w=>w.reliable).map(w=>clipTime(w.start)+' '+Math.round(w.probability*100)+'%').join('<br>')}</td></tr>`).join('')||'<tr><td colspan="5">暂无已检测反例候选；不能据此证明所有文件都是单一语种。</td></tr>';
 $('language-label-tables').innerHTML=s.stats.map(x=>`<article class="panel"><h3>${x.track} · 标签文字与原文</h3><p class="footnote">这里只描述标签文字，不判断音频语种。拉丁字母型含英文描述、人名及其他语言；汉字型也不能单凭字形认定实际语音。</p><div class="table-wrap"><table><thead><tr><th>文字类型</th><th>不同描述</th><th>出现次数</th></tr></thead><tbody>${Object.entries(x.label_scripts).map(([k,v])=>`<tr><td>${WRITING_NAMES[k]||k}</td><td>${fmt(v.unique_tags)}</td><td>${fmt(v.occurrences)}</td></tr>`).join('')}</tbody></table></div><h4>常见汉字型描述</h4><div class="detail-tags">${x.top_han.slice(0,12).map(t=>`<span class="small-badge">[${escapeHTML(t.tag)}] × ${fmt(t.count)}</span>`).join('')||'未发现'}</div><h4>常见拉丁字母型描述</h4><div class="detail-tags">${x.top_latin.slice(0,12).map(t=>`<span class="small-badge">[${escapeHTML(t.tag)}] × ${fmt(t.count)}</span>`).join('')}</div></article>`).join('');
 $('language-downloads').innerHTML=s.downloads.map(name=>`<a class="button quiet" href="language-audit/${encodeURIComponent(name)}" download>↓ ${escapeHTML(name)}</a>`).join('');
}
function languageFileMatch(r){const v=$('sample-audio-language')?.value||'all';return audioMatches(r,v)}
const languageEvidenceOverview=languageView;
languageView=function(){languageEvidenceOverview();const s=data.language_audit;if(!s)return;
 $('language-conclusions').innerHTML=(s.conclusions||[]).map(x=>`<p>${escapeHTML(x)}</p>`).join('');
 const codes=[...new Set(s.stats.flatMap(x=>Object.keys(x.audio_results)))].filter(k=>!['not_run','read_error','mixed_or_conflict','insufficient_evidence'].includes(k)).sort((a,b)=>s.stats.reduce((n,x)=>n+(x.audio_results[b]||0)-(x.audio_results[a]||0),0));
 $('language-distribution').innerHTML=codes.map(k=>`<tr><td>${escapeHTML(LANGUAGE_NAMES[k]||k)} <span class="sample-id">${k}</span></td>${s.stats.map(x=>`<td>${fmt(x.audio_results[k]||0)}</td>`).join('')}<td>${fmt(s.stats.reduce((n,x)=>n+(x.audio_results[k]||0),0))}</td></tr>`).join('');
 $('language-subtitle-matrix').innerHTML=(s.audio_subtitle_matrix||[]).map(r=>`<tr><td>${({zh:'中文候选',en:'英语候选',other:'其他语种候选',undetermined:'混合／不足／未查'})[r.audio_candidate]}</td>${['han_majority','non_han_majority','empty_or_unparsed','missing'].map(k=>`<td>${fmt(r[k])}</td>`).join('')}</tr>`).join('');
 $('language-review-audio').innerHTML=(s.review_examples||[]).map(c=>`<article class="clip-card"><span class="small-badge">${c.track} · ${escapeHTML(LANGUAGE_NAMES[c.language]||c.language)}候选</span><h4>${escapeHTML(c.title)}</h4><p class="clip-subtitle">围绕实际检测窗口提取的20秒复核片段；未人工确认。源位置 ${clipTime(c.clip_start)}–${clipTime(c.clip_end)}。</p><audio controls preload="none" src="${escapeHTML(clipSrc(c))}" aria-label="语种复核，${escapeHTML(c.id)}"></audio><div class="path-block">${escapeHTML(c.path)}</div></article>`).join('');
 $('language-review-audio').querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})));
};
const languageBaseDetail=detail;
detail=function(path){languageBaseDetail(path);const r=data.rows.find(r=>r.path===path);if(!r)return;const count=(data.context_examples||[]).filter(c=>c.path===path).length;$('detail-body').insertAdjacentHTML('beforeend',`<h3>语种与字幕证据</h3><p class="detail-note">音频：${escapeHTML(audioLanguageText(r))}（三个窗口模型抽查，不代表整片纯语种）。原清单：${escapeHTML((r.manifest_languages||[]).join(' / ')||'未声明')}。字幕：${r.subtitle_script==='han_majority'?'汉字为主':r.subtitle_script==='empty_or_unparsed'?'空字幕':r.subtitle_script==='missing'?'无配对字幕':'非汉字为主'}。本文件已提取 ${count} 段长情境样本，可在情境库查看。</p>`)};
const languageBaseInitSamples=initSamples;
initSamples=function(){languageBaseInitSamples();languageView();if(typeof OFFLINE_AUDIO!=='undefined')document.querySelectorAll('a[href^="language-audit/"]').forEach(a=>{a.href='https://moonitor-nju.github.io/netflix-speech-explorer-/'+a.getAttribute('href')})};
const languageBaseOverview=overview;
overview=function(){languageBaseOverview();const rs=scoped();$('category-chart').innerHTML=bars(Object.entries(data.taxonomy.parents).map(([k,v])=>({label:v.label,n:rs.reduce((s,r)=>s+(r.research_parent_categories?.[k]||0),0)})).sort((a,b)=>b.n-a.n))+'<p class="footnote">研究大类的描述出现次数。同一原始描述在同一大类内只计一次，但可跨大类命中，不能把各类直接相加作为总数。</p>'};
const languageEmptySubtitleOverview=overview;
overview=function(){languageEmptySubtitleOverview();const empty=data.rows.filter(r=>r.subtitle_script==='empty_or_unparsed').length;$('scan-banner').textContent=$('scan-banner').textContent.replace('个可用字幕已读',`个配对SRT已读取（其中${empty}个为空字幕）`)};
const languageBaseEvents=events;
events=function(){languageBaseEvents();
 $('listening-modes').onclick=e=>{const b=e.target.closest('[data-listen-mode]');if(!b)return;listenMode=b.dataset.listenMode;listenExact=null;listenLeaf=listenMode==='context'?'all':Object.keys(data.taxonomy.leaves).find(k=>data.taxonomy.leaves[k].parent===listenParent&&(data.audio_examples||[]).some(c=>c.leaf===k))||Object.keys(data.taxonomy.leaves).find(k=>data.taxonomy.leaves[k].parent===listenParent);listenPage=0;renderListening()};
 $('listen-parents').onclick=e=>{const b=e.target.closest('[data-listen-parent]');if(!b)return;listenParent=b.dataset.listenParent;listenLeaf='all';listenExact=null;listenPage=0;renderListening()};
 $('listen-prev').onclick=()=>{listenPage--;renderListening()};$('listen-next').onclick=()=>{listenPage++;renderListening()};
 $('listen-grid').onclick=e=>{const b=e.target.closest('[data-seek]');if(!b)return;const a=b.closest('.context-card').querySelector('audio');a.currentTime=Number(b.dataset.seek);a.play().catch(()=>toast('请点击播放器开始试听'))};
 $('sample-audio-language').onchange=()=>{samplePage=0;renderSamples()};
};
/* LANGUAGE_CONTEXT_UI_END */

/* SEARCH_LISTEN_UI_START */
// Separate full-corpus retrieval state from the curated listening library.
const searchBaseRender=researchBaseRenderSamples;
const searchEvidenceCache=new Map();
function selectedSearchCategory(){return $('sample-category').value||'all'}
function searchCategoryCount(r,value=selectedSearchCategory()){
 if(value==='all')return null;
 const [level,key]=value.split(':');
 return level==='parent'?(r.research_parent_categories?.[key]||0):(r.research_categories?.[key]||0);
}
function searchCategoryLabel(value=selectedSearchCategory()){
 if(value==='all')return '全部声音类型';
 const [level,key]=value.split(':');return level==='parent'?data.taxonomy.parents[key]?.label:taxPath(key);
}
function searchEvidence(pageRows){
 const value=selectedSearchCategory(), cacheKey=value+'\n'+(currentTag||'')+'\n'+pageRows.map(r=>r.path).join('\n');
 if(searchEvidenceCache.has(cacheKey))return searchEvidenceCache.get(cacheKey);
 const evidence=new Map(pageRows.map(r=>[r.path,[]]));
 const [level,key]=value.split(':');
 for(const t of data.tags){
  if(currentTag!==null?t.tag!==currentTag:value!=='all'&&!t.taxonomy.some(k=>level==='leaf'?k===key:data.taxonomy.leaves[k]?.parent===key))continue;
  for(const i of data.tag_file_indices[t.tag]||[]){const tags=evidence.get(data.rows[i].path);if(tags&&tags.length<5)tags.push(t.tag)}
 }
 if(searchEvidenceCache.size>8)searchEvidenceCache.clear();searchEvidenceCache.set(cacheKey,evidence);return evidence;
}
function renderSearchSelectors(){
 const value=selectedSearchCategory(),[level,key]=value.split(':');
 const parent=level==='parent'?key:level==='leaf'?data.taxonomy.leaves[key]?.parent:'all';
 $('search-parent').innerHTML='<option value="all">全部大类</option>'+Object.entries(data.taxonomy.parents).map(([k,v])=>`<option value="${k}">${escapeHTML(v.label)}</option>`).join('');
 $('search-parent').value=parent;
 $('search-leaf').innerHTML='<option value="all">当前大类 · 全部小类</option>'+Object.entries(data.taxonomy.leaves).filter(([k,v])=>parent==='all'||v.parent===parent).map(([k,v])=>`<option value="${k}">${escapeHTML(parent==='all'?data.taxonomy.parents[v.parent].label+' / '+v.label:v.label)}</option>`).join('');
 $('search-leaf').value=level==='leaf'?key:'all';
}
renderSamples=function(){
 // The original renderer owns filtering and pagination only; listening state is independent.
 searchBaseRender();renderSearchSelectors();
 const pageRows=filteredSamples.slice(samplePage*PAGE_SIZE,(samplePage+1)*PAGE_SIZE),evidence=searchEvidence(pageRows);
 $('search-query-summary').textContent=`${searchCategoryLabel()}${currentTag!==null?' · 原始描述 ['+currentTag+']':''} · ${fmt(filteredSamples.length)} 个候选文件`;
 $('sample-table').innerHTML=pageRows.map(r=>{
  const hits=searchCategoryCount(r),tags=evidence.get(r.path)||[];
  return `<tr><td><button class="sample-name" data-path="${escapeHTML(r.path)}">${escapeHTML(r.title||r.id)}${r.season!==null?` <span class="sample-id">S${r.season} E${r.episode}</span>`:''}</button><span class="sample-id">${escapeHTML(r.id)} · ${r.type==='show'?'剧集':r.type==='movie'?'电影':'类型未记录'}</span><span class="sample-id">${r.duration===null?'时长未知':(r.duration/60).toFixed(1)+' 分钟'} · ${escapeHTML(r.group)} / ${escapeHTML(r.track)}</span></td><td><strong>${hits===null?(currentTag!==null?'原始标签命中':'已记录标签线索'):fmt(hits)+' 次描述命中'}</strong><div class="search-hit-tags">${tags.map(t=>`<span class="small-badge">[${escapeHTML(t)}]</span>`).join('')||'<span class="sample-id">无可展示的方括号描述；不代表没有声音事件</span>'}</div><span class="sample-id">${hits===null?'':escapeHTML(searchCategoryLabel())+' · '}最多展示 5 种命中描述</span></td><td><code class="search-path">${escapeHTML(r.path)}</code><div class="button-row"><button class="button quiet" data-copy-wav="${escapeHTML(r.path)}">复制 WAV 路径</button><button class="button quiet" data-path="${escapeHTML(r.path)}">详情</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="3" class="empty">没有匹配文件，请放宽声音类型、语种或其他筛选条件。无标签不能据此判定无对应声音。</td></tr>';
};
const splitBaseInitSamples=initSamples;
initSamples=function(){splitBaseInitSamples();$('sample-track').value='all';renderSamples()};
view=function(){
 let id=location.hash.slice(1)||'overview';if(id==='samples')id='listen';
 if(!['overview','labels','languages','quality','listen','search','guide'].includes(id))id='overview';
 document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+id);
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.dataset.view===id));
 $('breadcrumb').textContent={overview:'数据概览',labels:'标签图谱',languages:'语种与标签体系',quality:'质量检查',listen:'样例试听',search:'数据检索',guide:'使用指南'}[id];
 document.querySelectorAll('audio').forEach(a=>a.pause());window.scrollTo({top:0});
};
async function copyWavPaths(paths){
 const text=paths.join('\n');if(!text)return toast('当前没有可复制的候选文件');
 try{await navigator.clipboard.writeText(text);toast(`已复制 ${paths.length} 条 WAV 路径`)}catch{window.prompt('复制服务器 WAV 路径',text)}
}
const splitBaseEvents=events;
events=function(){splitBaseEvents();
 $('search-parent').onchange=e=>{const p=e.target.value;$('sample-category').value=p==='all'?'all':'parent:'+p;samplePage=0;renderSamples()};
 $('search-leaf').onchange=e=>{const p=$('search-parent').value;$('sample-category').value=e.target.value==='all'?(p==='all'?'all':'parent:'+p):'leaf:'+e.target.value;samplePage=0;renderSamples()};
 const originalReset=$('reset-filters').onclick;
 $('reset-filters').onclick=()=>{$('sample-audio-language').value='all';originalReset();$('sample-track').value='all';renderSamples()};
 $('sample-table').onclick=e=>{const c=e.target.closest('[data-copy-wav]');if(c)return void copyWavPaths([c.dataset.copyWav]);const b=e.target.closest('[data-path]');if(b)detail(b.dataset.path)};
 $('copy-result-paths').onclick=()=>copyWavPaths(filteredSamples.map(r=>r.path));
 $('export-paths').onclick=()=>{if(!filteredSamples.length)return toast('当前没有可导出的候选文件');download('netflix-filtered-wav-paths.txt',filteredSamples.map(r=>r.path).join('\n')+'\n','text/plain;charset=utf-8')};
 $('export-csv').onclick=()=>{const keys=['id','title','title_id','season','episode','episode_title','type','rating','year','group','track','path','duration','duration_source','header_checked','sr','channels','bits','srt','subtitle_status','cues','tagged_cues','bracket_only','lyric_cues','overlap','bad_time','out_of_bounds','wer','wer_status','wer_median','asr_transcribe_seconds','asr_recorded_duration','asr_cc_total_segments','wer_csv_median','wer_csv_duration_s','wer_source','wer_scored_segments','wer_ref_words','wer_edits','wer_micro','metadata_status','metadata_path','metadata_episode_path','metadata_runtime','metadata_id','boundary_checked','subtitle_span_union_seconds','wer_num_parts','wer_speech_segments','analyzed','han_cues','subtitle_seconds','errors','counterpart_path','manifest_languages','audio_language','audio_language_status','subtitle_script','tag_categories','research_categories','research_parent_categories','tags'];download('netflix-sound-retrieval.csv',csv([['selected_sound_category','category_description_occurrences','selected_raw_tag',...keys.map(k=>k==='tags'?'top_12_tags':k)],...filteredSamples.map(r=>[selectedSearchCategory(),searchCategoryCount(r),currentTag,...keys.map(k=>typeof r[k]==='object'&&r[k]!==null?JSON.stringify(r[k]):r[k])])]),'text/csv;charset=utf-8')};
 $('listen-find-files').onclick=()=>{currentTag=listenExact;$('sample-category').value=listenLeaf==='all'?'parent:'+listenParent:'leaf:'+listenLeaf;$('sample-track').value='all';samplePage=0;renderSamples();location.hash='search'};
};
/* SEARCH_LISTEN_UI_END */

/* AUDIO_RECOVERY_UI_START */
const recoveredAudioObjects=new Map();
function cleanAudioObjects(){for(const [audio,url] of recoveredAudioObjects)if(!audio.isConnected){URL.revokeObjectURL(url);recoveredAudioObjects.delete(audio)}}
function audioLoadStatus(audio,message,error=false){
 const card=audio.closest('.clip-card')||audio.parentElement;
 const notice=card.querySelector('.audio-error');if(notice)notice.hidden=!error;
 const status=card.querySelector('.audio-load-status');if(status){status.textContent=message;status.classList.toggle('issue',error)}
}
async function reloadAudio(audio){
 if(audio.dataset.recovering==='true')return;
 audio.dataset.recovering='true';const card=audio.closest('.clip-card')||audio.parentElement,button=card.querySelector('[data-reload-audio]');
 if(button)button.disabled=true;audioLoadStatus(audio,'正在完整读取音频，请稍候…');
 const original=audio.dataset.originalSrc,position=audio.currentTime||0;
 let timer;
 try{
  audio.pause();
  if(original.startsWith('data:')){audio.src=original;audio.load();return}
  const controller=new AbortController();timer=setTimeout(()=>controller.abort(),30000);
  const url=new URL(original,document.baseURI);url.searchParams.set('audio_retry',Date.now());
  const response=await fetch(url.href,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const blob=await response.blob(),header=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  const text=String.fromCharCode(...header);
  if(text.slice(0,4)!=='RIFF'||text.slice(8,12)!=='WAVE'||new DataView(header.buffer).getUint32(4,true)+8>blob.size)throw Error('WAV 内容不完整');
  const previous=recoveredAudioObjects.get(audio),objectUrl=URL.createObjectURL(blob);
  recoveredAudioObjects.set(audio,objectUrl);
  audio.addEventListener('loadedmetadata',()=>{if(position>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,audio.duration)}, {once:true});
  audio.src=objectUrl;audio.load();if(previous)URL.revokeObjectURL(previous);
  audioLoadStatus(audio,'已重新读取音频，请点击播放。');
 }catch(error){audioLoadStatus(audio,'重载未成功，可再次重试或单独打开 WAV。',true)}
 finally{clearTimeout(timer);audio.dataset.recovering='false';if(button)button.disabled=false}
}
function wireAudioRecovery(root){
 cleanAudioObjects();if(!root)return;
 root.querySelectorAll('audio').forEach(audio=>{
  if(audio.dataset.recoveryWired)return;audio.dataset.recoveryWired='true';audio.dataset.originalSrc=audio.getAttribute('src');
  const actions=document.createElement('div');actions.className='audio-recovery-actions';
  actions.innerHTML=`<button class="listen-link" data-reload-audio type="button">↻ 重新加载音频</button><a class="listen-link" href="${escapeHTML(audio.dataset.originalSrc)}" target="_blank" rel="noopener">单独打开 WAV ↗</a><span class="audio-load-status" role="status"></span>`;
  audio.insertAdjacentElement('afterend',actions);actions.querySelector('[data-reload-audio]').onclick=()=>reloadAudio(audio);
  audio.addEventListener('error',()=>{
   if(!audio.dataset.automaticRetry){audio.dataset.automaticRetry='true';reloadAudio(audio)}
   else if(audio.dataset.recovering!=='true')audioLoadStatus(audio,'音频未能加载，可点击重新加载或单独打开 WAV。',true);
  });
  audio.addEventListener('loadedmetadata',()=>{audioLoadStatus(audio,'');const notice=(audio.closest('.clip-card')||audio.parentElement).querySelector('.audio-error');if(notice)notice.hidden=true});
 });
}
const recoveryBaseListening=renderListening;
renderListening=function(){recoveryBaseListening();wireAudioRecovery($('listen-grid'))};
const recoveryBaseLanguages=languageView;
languageView=function(){recoveryBaseLanguages();wireAudioRecovery($('language-review-audio'))};
const recoveryBaseDetail=detail;
detail=function(path){recoveryBaseDetail(path);wireAudioRecovery($('detail-body'))};
/* AUDIO_RECOVERY_UI_END */

init();


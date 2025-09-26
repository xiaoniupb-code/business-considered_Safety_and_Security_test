(function(){
  const data = window.DATASET || [];
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const state = {
    search: '',
    type: '',
    scene: '',
    need: '',
    activeChip: null // { kind: 'type'|'scene'|'need', value: string }
  };

  const els = {
    year: $('#year'),
    searchInput: $('#searchInput'),
    typeFilter: $('#typeFilter'),
    sceneFilter: $('#sceneFilter'),
    needFilter: $('#needFilter'),
    resetBtn: $('#resetBtn'),
    exportBtn: $('#exportBtn'),
    tableBody: $('#dataTable tbody'),
    emptyState: $('#emptyState'),
    typeChips: $('#typeChips'),
    sceneChips: $('#sceneChips'),
    needChips: $('#needChips')
  };

  function thisYear(){ els.year.textContent = new Date().getFullYear(); }

  // 解析关键需求为数组
  function splitNeeds(str){
    if(!str) return [];
    return str
      .split(/[,，、]/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 预处理：附加拆分后的需求数组
  const rows = data.map((r, idx) => ({
    id: idx,
    type: String(r['业务类型'] || '').trim(),
    scene: String(r['应用场景'] || '').trim(),
    needsRaw: String(r['关键广义功能安全需求'] || '').trim(),
    needs: splitNeeds(r['关键广义功能安全需求'])
  }));

  // 唯一集合
  function unique(arr){ return Array.from(new Set(arr)); }

  const allTypes = unique(rows.map(r => r.type));
  const allScenes = unique(rows.flatMap(r => r.scene.split(/[,，、]/g).map(s=>s.trim()).filter(Boolean)));
  const allNeeds = unique(rows.flatMap(r => r.needs));

  function fillSelect(select, values){
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function buildChips(container, values, kind){
    container.innerHTML = '';
    values.forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = v;
      chip.dataset.kind = kind;
      chip.dataset.value = v;
      chip.addEventListener('click', onChipClick);
      container.appendChild(chip);
    });
    updateChipActive();
  }

  function onChipClick(e){
    const chip = e.currentTarget;
    const kind = chip.dataset.kind;
    const value = chip.dataset.value;

    // 切换逻辑：再点同一个取消
    if(state.activeChip && state.activeChip.kind === kind && state.activeChip.value === value){
      state.activeChip = null;
      // 不改变下拉筛选，仅取消高亮
      render();
      return;
    }
    // 设置活动 chip 并同步到对应筛选器
    state.activeChip = { kind, value };
    if(kind === 'type'){ state.type = value; els.typeFilter.value = value; }
    if(kind === 'scene'){ state.scene = value; els.sceneFilter.value = value; }
    if(kind === 'need'){ state.need = value; els.needFilter.value = value; }

    render();
  }

  function updateChipActive(){
    $$('.chip').forEach(ch => {
      const kind = ch.dataset.kind;
      const value = ch.dataset.value;
      const active = state.activeChip && state.activeChip.kind === kind && state.activeChip.value === value;
      ch.classList.toggle('active', !!active);
    });
  }

  function normalize(s){ return String(s || '').toLowerCase(); }

  function matchSearch(row){
    if(!state.search.trim()) return true;
    const tokens = state.search.toLowerCase().split(/\s+/).filter(Boolean);
    if(tokens.length === 0) return true;

    const hay = [
      row.type,
      row.scene,
      row.needsRaw,
      ...row.needs
    ].join(' ').toLowerCase();

    return tokens.every(t => hay.includes(t));
  }

  function matchFilters(row){
    const byType = !state.type || row.type === state.type;
    // 场景：多值内匹配
    const sceneItems = row.scene.split(/[,，、]/g).map(s=>s.trim());
    const byScene = !state.scene || sceneItems.includes(state.scene);
    // 需求：数组内匹配
    const byNeed = !state.need || row.needs.includes(state.need);
    return byType && byScene && byNeed;
  }

  function filterRows(){
    return rows.filter(r => matchSearch(r) && matchFilters(r));
  }

  function renderTable(filtered){
    els.tableBody.innerHTML = '';
    if(filtered.length === 0){
      els.emptyState.classList.remove('hidden');
      return;
    }
    els.emptyState.classList.add('hidden');

    filtered.forEach(r => {
      const tr = document.createElement('tr');

      const tdType = document.createElement('td');
      tdType.textContent = r.type;

      const tdScene = document.createElement('td');
      tdScene.textContent = r.scene;

      const tdNeed = document.createElement('td');
      // 用 chips 展示需求，点击可映射筛选
      const frag = document.createDocumentFragment();
      r.needs.forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = n;
        chip.dataset.kind = 'need';
        chip.dataset.value = n;
        chip.addEventListener('click', onChipClick);
        frag.appendChild(chip);
        frag.appendChild(document.createTextNode(' '));
      });
      tdNeed.appendChild(frag);

      tr.appendChild(tdType);
      tr.appendChild(tdScene);
      tr.appendChild(tdNeed);

      // 显示高亮：当有活动 chip 时，高亮匹配行
      let highlight = false;
      if(state.activeChip){
        const {kind, value} = state.activeChip;
        if(kind === 'type' && r.type === value) highlight = true;
        if(kind === 'scene' && r.scene.split(/[,，、]/g).map(s=>s.trim()).includes(value)) highlight = true;
        if(kind === 'need' && r.needs.includes(value)) highlight = true;
      }
      tr.classList.toggle('highlight', highlight);

      els.tableBody.appendChild(tr);
    });
  }

  function render(){
    updateChipActive();
    const filtered = filterRows();
    renderTable(filtered);
  }

  // 导出 CSV（基于当前筛选结果）
  function exportCSV(){
    const filtered = filterRows();

    const header = ['业务类型','应用场景','关键广义功能安全需求'];
    const rowsCSV = filtered.map(r => [
      wrapCSV(r.type),
      wrapCSV(r.scene),
      wrapCSV(r.needs.join('、'))
    ].join(','));

    const csv = [header.join(','), ...rowsCSV].join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replaceAll(':','-').slice(0,19);
    a.href = url;
    a.download = `业务映射导出_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // CSV 字段包装（处理逗号与引号）
  function wrapCSV(val){
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g,'""')}"`;
    }
    return s;
  }

  // 事件绑定
  function bindEvents(){
    els.searchInput.addEventListener('input', (e) => {
      state.search = e.target.value || '';
      render();
    });
    els.typeFilter.addEventListener('change', (e) => {
      state.type = e.target.value;
      // 如果筛选器改变，清除与其冲突的 activeChip
      if(state.activeChip && state.activeChip.kind === 'type' && state.activeChip.value !== state.type){
        state.activeChip = null;
      }
      render();
    });
    els.sceneFilter.addEventListener('change', (e) => {
      state.scene = e.target.value;
      if(state.activeChip && state.activeChip.kind === 'scene' && state.activeChip.value !== state.scene){
        state.activeChip = null;
      }
      render();
    });
    els.needFilter.addEventListener('change', (e) => {
      state.need = e.target.value;
      if(state.activeChip && state.activeChip.kind === 'need' && state.activeChip.value !== state.need){
        state.activeChip = null;
      }
      render();
    });
    els.resetBtn.addEventListener('click', () => {
      state.search = '';
      state.type = '';
      state.scene = '';
      state.need = '';
      state.activeChip = null;
      els.searchInput.value = '';
      els.typeFilter.value = '';
      els.sceneFilter.value = '';
      els.needFilter.value = '';
      render();
    });
    els.exportBtn.addEventListener('click', exportCSV);
  }

  // 初始化
  function init(){
    thisYear();
    fillSelect(els.typeFilter, allTypes);
    fillSelect(els.sceneFilter, allScenes);
    fillSelect(els.needFilter, allNeeds);

    buildChips(els.typeChips, allTypes, 'type');
    buildChips(els.sceneChips, allScenes, 'scene');
    buildChips(els.needChips, allNeeds, 'need');

    bindEvents();
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
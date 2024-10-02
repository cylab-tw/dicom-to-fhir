// 全局變量
let allStudies = [];
let currentPage = 1;
let itemsPerPage = 10;

// 保留主要的頁面交互函數
async function queryStudies() {
    const baseUrl = document.getElementById('dicom-url').value;
    const patientId = document.getElementById('patient-id').value;
    const studyUid = document.getElementById('study-uid').value;
    const accessionNumber = document.getElementById('accession-number').value;

    let url = `${baseUrl}/studies?`;
    if (patientId) url += `PatientID=${patientId}&`;
    if (studyUid) url += `StudyInstanceUID=${studyUid}&`;
    if (accessionNumber) url += `AccessionNumber=${accessionNumber}&`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.status === 404) {
            // 404 表示沒有查詢結果
            allStudies = [];
        } else if (!response.ok) {
            // 其他非 200 狀態碼視為錯誤
            throw new Error(`HTTP error! status: ${response.status}`);
        } else {
            // 成功獲取數據，先檢查是否有內容
            const text = await response.text();
            if (text.trim().length > 0) {
                allStudies = JSON.parse(text);
            } else {
                allStudies = [];
            }
        }
        
        currentPage = 1;
        displayStudies();
    } catch (error) {
        console.error('查詢研究時發生錯誤:', error);
        document.getElementById('study-list').innerHTML = `<div class="alert alert-danger">查詢研究時發生錯誤: ${error.message}</div>`;
    }
}

function displayStudies() {
    const studyList = document.getElementById('study-list');
    studyList.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageStudies = allStudies.slice(startIndex, endIndex);

    // 創建表格
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';
    
    // 創建表頭
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Study Date</th>
            <th>Patient Name</th>
            <th>Accession Number</th>
            <th>Patient ID</th>
            <th style="max-width: 200px;">Study Instance UID</th>
            <th>操作</th>
        </tr>
    `;
    table.appendChild(thead);

    // 創建表體
    const tbody = document.createElement('tbody');
    pageStudies.forEach(study => {
        const tr = document.createElement('tr');
        
        const studyDate = study['00080020'] && study['00080020'].Value ? study['00080020'].Value[0] : 'N/A';
        const patientName = study['00100010'] && study['00100010'].Value && study['00100010'].Value[0].Alphabetic
            ? study['00100010'].Value[0].Alphabetic
            : 'N/A';
        const accessionNumber = study['00080050'] && study['00080050'].Value ? study['00080050'].Value[0] : 'N/A';
        const patientID = study['00100020'] && study['00100020'].Value ? study['00100020'].Value[0] : 'N/A';
        const studyInstanceUID = study['0020000D'] && study['0020000D'].Value ? study['0020000D'].Value[0] : 'N/A';
        
        tr.innerHTML = `
            <td>${studyDate}</td>
            <td>${patientName}</td>
            <td>${accessionNumber}</td>
            <td>${patientID}</td>
            <td style="max-width: 200px; word-break: break-all;">${studyInstanceUID}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="processStudy('${studyInstanceUID}')">轉換成FHIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    studyList.appendChild(table);

    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('items-per-page').value = itemsPerPage;
}

function changePage(delta) {
    const maxPage = Math.ceil(allStudies.length / itemsPerPage);
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > maxPage) currentPage = maxPage;
    displayStudies();
}

function changeItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('items-per-page').value);
    currentPage = 1;
    displayStudies();
}

async function processStudy(studyInstanceUid) {
    // 顯示加載指示器
    document.getElementById('json-result').innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';

    try {
        let imagingStudy = await loadJson("./ImagingStudy-ImagingStudyBase.json");
        let studyData = await queryStudy(studyInstanceUid);
        let seriesData = await querySeries(studyInstanceUid);
        let instanceData = {};
        for(let i = 0; i < seriesData.length; i++) {
            instanceData[seriesData[i]['0020000E']['Value'][0]] = await queryInstances(studyInstanceUid, seriesData[i]['0020000E']['Value'][0]);
        }
        
        // 使用 await 來獲取 fillImagingStudy 的結果
        let resultImagingStudy = await fillImagingStudy(imagingStudy, studyData, seriesData, instanceData);
        
        // 使用 JSONFormatter 顯示結果，並調整配置
        const formatter = new JSONFormatter(resultImagingStudy, 2, {
            hoverPreviewEnabled: true,
            hoverPreviewArrayCount: 100,
            hoverPreviewFieldCount: 5,
            theme: '', // 使用自定義主題
            animateOpen: false,
            animateClose: false
        });

        const jsonResultElement = document.getElementById('json-result');
        jsonResultElement.innerHTML = '';
        jsonResultElement.appendChild(formatter.render());

        // 設置複製按鈕功能
        setupCopyButton(resultImagingStudy);

        document.getElementById('fhir-result-tab').click();
    } catch (error) {
        console.error('處理研究時發生錯誤:', error);
        document.getElementById('json-result').innerHTML = `<div class="alert alert-danger">處理研究時發生錯誤: ${error.message}</div>`;
    }
}
// 全局變量
let allStudies = [];
let currentPage = 1;
let itemsPerPage = 10;

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
        allStudies = await response.json();
        currentPage = 1;
        displayStudies();
    } catch (error) {
        console.error('Error querying studies:', error);
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

    let imagingStudy = await loadJson("./ImagingStudy-ImagingStudyBase.json");
    let studyData = await queryStudy(studyInstanceUid);
    let seriesData = await querySeries(studyInstanceUid);
    let instanceData = {};
    for(let i = 0; i < seriesData.length; i++) {
        instanceData[seriesData[i]['0020000E']['Value'][0]] = await queryInstances(studyInstanceUid, seriesData[i]['0020000E']['Value'][0]);
    }
    let resultImagingStudy = fillImagingStudy(imagingStudy, studyData, seriesData, instanceData);
    
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
}

/**
 * DICOM to FHIR Imaging Study
 * @param {*} imagingStudy base json
 * @param {*} studyData 
 * @param {*} seriesData 
 * @param {*} instanceData 
 * @returns imaging study result
 */
function fillImagingStudy(imagingStudy, studyData, seriesData, instanceData) {
    // Check and fill in study instance uid               
    if (studyData[0]['0020000D'] && studyData[0]['0020000D']['Value'] && studyData[0]['0020000D']['Value'][0]) {
        imagingStudy.identifier[0].value = `urn:oid:${studyData[0]['0020000D']['Value'][0]}`;
    }

    // Check and fill in Accession Number
    if (studyData[0]['00080050'] && studyData[0]['00080050']['Value'] && studyData[0]['00080050']['Value'][0]) {
        imagingStudy.identifier[1].value = `${studyData[0]['00080050']['Value'][0]}`;
    }

    // Fill in Number Of Instances
    imagingStudy.numberOfInstances = 0;
    for(let i = 0; i < Object.keys(instanceData).length; i++){
        imagingStudy.numberOfInstances += instanceData[Object.keys(instanceData)[i]].length;
    }

    // Fill in Number Of Series
    imagingStudy.numberOfSeries = seriesData.length;
    
    // Fill in procedure code only if it exists
    if (studyData[0]['00081032'] && studyData[0]['00081032']['Value']) {
        let procedureCodeSequence = studyData[0]['00081032']['Value'];
        let procedureCodes = [];
        
        for (let i = 0; i < procedureCodeSequence.length; i++) {
            let codeItem = procedureCodeSequence[i];
            let code = codeItem['00080100'] ? codeItem['00080100']['Value'][0] : null;
            let display = codeItem['00080104'] ? codeItem['00080104']['Value'][0] : '';
            let system = codeItem['00080102'] ? codeItem['00080102']['Value'][0] : 'https://twcore.mohw.gov.tw/ig/emr/CodeSystem/ICD-10-procedurecode';
            
            if (code) {
                procedureCodes.push({
                    "coding": [{
                        "system": system,
                        "code": code,
                        "display": display
                    }]
                });
            }
        }
        
        // Only add procedureCode to imagingStudy if we found valid codes
        if (procedureCodes.length > 0) {
            imagingStudy.procedureCode = procedureCodes;
        }
    }

    // Fill in the series
    imagingStudy.series = [];
    for(let i = 0; i < seriesData.length; i++){
        let thisSeries = {};
        thisSeries.uid = seriesData[i]['0020000E']['Value'][0];
        thisSeries.modality = {
            "system": "https://twcore.mohw.gov.tw/ig/emr/CodeSystem/AcquisitionModality",
            "code": seriesData[i]['00080060']['Value'][0]
        };
        thisSeries.numberOfInstances = instanceData[thisSeries.uid].length;
        thisSeries.instance = [];
        for(let j = 0; j < instanceData[thisSeries.uid].length; j++){
            
            thisSeries.bodySite = {
                "system": "http://snomed.info./sct",
                "code": "251007",
                "display": "Pectoral region"
            };

            let thisInstance = {
                "uid": instanceData[thisSeries.uid][j]["00080018"]['Value'][0],
                "sopClass": {
                    "system": "https://twcore.mohw.gov.tw/ig/emr/CodeSystem/DicomsopClass",
                    "code": `urn:oid:${instanceData[thisSeries.uid][j]["00080016"]['Value'][0]}`
                }
            };

            thisSeries.instance.push(thisInstance);

        }
        imagingStudy.series.push(thisSeries);
    }
    return imagingStudy;

}

/**
 * Load OAuth config file.
 */
function loadJson(url) {
    return new Promise((resolve, reject) => {
        let config = {};
        let requestURL = url;
        let request = new XMLHttpRequest();
        request.open('GET', requestURL);
        request.responseType = 'json';
        request.send();
        request.onload = function () {
            config = request.response;
            return resolve(config);
        }
    });
}

function queryStudy(studyUID) {
    return new Promise((resolve, reject) => {
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies?StudyInstanceUID=${studyUID}`;

        fetch(url, {
            headers: { 'Accept': 'application/json' }
        })
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(error => reject(`Error querying study: ${error}`));
    });
}

function querySeries(studyUID) {
    return new Promise((resolve, reject) => {
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies/${studyUID}/series`;

        fetch(url, {
            headers: { 'Accept': 'application/json' }
        })
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(error => reject(`Error querying series: ${error}`));
    });
}

function queryInstances(studyUID, seriesUID) {
    return new Promise((resolve, reject) => {
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies/${studyUID}/series/${seriesUID}/instances`;

        fetch(url, {
            headers: { 'Accept': 'application/json' }
        })
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(error => reject(`Error querying instances: ${error}`));
    });
}

function copyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

function setupCopyButton(resultImagingStudy) {
    const copyButton = document.getElementById('copy-result');
    copyButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(resultImagingStudy, null, 2);
        copyToClipboard(jsonString);
        alert('結果已複製到剪貼板');
    });
}
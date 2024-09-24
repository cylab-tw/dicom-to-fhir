async function main() {

    let imagingStudy = await loadJson("./ImagingStudy-ImagingStudyBase.json"); 
    console.log(imagingStudy);
    // 1. Query DICOM by StudyInstanceUID 查詢dicom
    let studyData = await queryStudy();
    let seriesData = await querySeries(studyData[0]['0020000D']['Value'][0]);
    let instanceData = {};
    for(let i = 0; i < seriesData.length; i++) {
        instanceData[seriesData[i]['0020000E']['Value'][0]] = await queryInstances(studyData[0]['0020000D']['Value'][0], seriesData[i]['0020000E']['Value'][0]);
    }
    console.log(studyData);
    console.log(seriesData);
    console.log(instanceData);
    // 2. Fill in the FHIR JSON using the DICOM Query Result 將dicom查詢結果填入fhir ImagingStudy
    let resultImagingStudy = fillImagingStudy(imagingStudy,studyData,seriesData,instanceData);
    // 3. Put the FHIR JSON Result in Textarea. 顯示結果
    console.log(resultImagingStudy);
    document.getElementById('result').innerText = JSON.stringify(resultImagingStudy);
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
    
    // Fill in procedure code
    imagingStudy.procedureCode = [];
    if (studyData[0]['00081032'] && studyData[0]['00081032']['Value']) {
        for (let i = 0; i < studyData[0]['00081032']['Value'].length; i++) {
            let codeItem = studyData[0]['00081032']['Value'][i];
            let code = codeItem['00080015'] ? codeItem['00080015']['Value'][0] : 
                       (codeItem['00080100'] ? codeItem['00080100']['Value'][0] : null);
            let display = codeItem['00080104'] ? codeItem['00080104']['Value'][0] : '';
            
            if (code) {
                imagingStudy.procedureCode.push({
                    "coding": [{
                        "system": "https://twcore.mohw.gov.tw/ig/emr/CodeSystem/ICD-10-procedurecode",
                        "code": code,
                        "display": display
                    }]
                });
            }
        }
    }

    /*// If no procedure codes were found, add one with empty code and display
    if (imagingStudy.procedureCode.length === 0) {
        imagingStudy.procedureCode.push({
            "coding": [{
                "system": "https://twcore.mohw.gov.tw/ig/emr/CodeSystem/ICD-10-procedurecode",
                "code": "",
                "display": ""
            }]
        });
    }*/

    // Check and fill in additional procedure codes
    if(studyData[0]['00081032'] && studyData[0]['00081032']['Value']) {
        for(let i = 0; i < studyData[0]['00081032']['Value'].length; i++){
            let thisCodeData = studyData[0]['00081032']['Value'][i];
            if (thisCodeData['00080100'] && thisCodeData['00080100']['Value'] && 
                thisCodeData['00080104'] && thisCodeData['00080104']['Value']) {
                let thisCode = {
                    "coding": [{
                        "system": "https://twcore.mohw.gov.tw/ig/emr/CodeSystem/ICD-10-procedurecode",
                        "code": thisCodeData['00080100']['Value'][0],
                        "display": thisCodeData['00080104']['Value'][0]
                    }]
                };
                imagingStudy.procedureCode.push(thisCode);
            }
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
                "code": "251007", // should be instance's tag 00082218.00080100
                "display": "Pectoral region" // should be instance's tag 00082218.00080104
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

// Function to query Study by StudyInstanceUID using XMLHttpRequest
function queryStudy() {
    return new Promise((resolve, reject) => {
        const studyUID = document.getElementById('study-uid').value;
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies?StudyInstanceUID=${studyUID}`;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } else {
                    reject(`Error querying study: ${xhr.status} ${xhr.statusText}`);
                }
            }
        };
        xhr.send();
    });
}

// Function to query Series by StudyInstanceUID using XMLHttpRequest
function querySeries(studyUID) {
    return new Promise((resolve, reject) => {
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies/${studyUID}/series`;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } else {
                    reject(`Error querying series: ${xhr.status} ${xhr.statusText}`);
                }
            }
        };
        xhr.send();
    });
}

// Function to query Instances by SeriesInstanceUID using XMLHttpRequest
function queryInstances(studyUID, seriesUID) {
    return new Promise((resolve, reject) => {
        const baseUrl = document.getElementById('dicom-url').value;
        const url = `${baseUrl}/studies/${studyUID}/series/${seriesUID}/instances`;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } else {
                    reject(`Error querying instances: ${xhr.status} ${xhr.statusText}`);
                }
            }
        };
        xhr.send();
    });
}
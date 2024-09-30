async function fillImagingStudy(imagingStudy, studyData, seriesData, instanceData) {
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
                    
            // 1. 從seriesData獲取dicomBodyPart
            let dicomBodyPart = seriesData[i]['00080015'] && seriesData[i]['00080015']['Value'] 
                ? seriesData[i]['00080015']['Value'][0] 
                : null;

            // 2. 載入bodySiteCode.json
            let bodySiteCode = await loadJson("./bodySiteCode.json");

            // 3. 如果dicomBodyPart為null，使用bodySiteCode中的第一個對象作為預設值
            // 否則，查找匹配的bodySite，如果沒有找到匹配項，也使用第一個對象
            let matchedBodySite = dicomBodyPart
                ? (bodySiteCode.find(site => site.Code === dicomBodyPart) || bodySiteCode[0])
                : bodySiteCode[0];

            // 4. 設置thisSeries.bodySite
            thisSeries.bodySite = {
                "system": matchedBodySite.System,
                "code": matchedBodySite.Code,
                "display": matchedBodySite.Display
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
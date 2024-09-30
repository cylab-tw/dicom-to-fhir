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
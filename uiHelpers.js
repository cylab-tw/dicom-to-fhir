function setupCopyButton(resultImagingStudy) {
    const copyButton = document.getElementById('copy-result');
    copyButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(resultImagingStudy, null, 2);
        copyToClipboard(jsonString);
        alert('結果已複製到剪貼板');
    });
}

// 可以添加其他 UI 相關的輔助函數
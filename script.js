// --- DOM 요소 가져오기 ---
const fileInput = document.getElementById('fileInput');
const frameListContainer = document.getElementById('frame-list-container');
const avgButton = document.getElementById('avgButton');

const rangeMinInput = document.getElementById('rangeMinInput');
const rangeMaxInput = document.getElementById('rangeMaxInput');
const pixelInfo = document.getElementById('pixel-info');

const rangeMin = document.getElementById('rangeMin');
const rangeMax = document.getElementById('rangeMax');
const rangeMinDisplay = document.getElementById('rangeMinDisplay');
const rangeMaxDisplay = document.getElementById('rangeMaxDisplay');

const previewCanvas = document.getElementById('previewCanvas');
const pCtx = previewCanvas.getContext('2d');
const profileCanvas = document.getElementById('profileCanvas');
const pfCtx = profileCanvas.getContext('2d');

const setPeak1Btn = document.getElementById('setPeak1');
const setPeak2Btn = document.getElementById('setPeak2');
const peakDeltaDisplay = document.getElementById('peakDelta');
const peakCenterDisplay = document.getElementById('peakCenter');

const setIntegral1Btn = document.getElementById('setIntegral1');
const setIntegral2Btn = document.getElementById('setIntegral2');
const integralValueDisplay = document.getElementById('integralValue');

const cropXFrom = document.getElementById('cropXFrom');
const cropXTo = document.getElementById('cropXTo');
const cropXStep = document.getElementById('cropXStep');
const cropYFrom = document.getElementById('cropYFrom');
const cropYTo = document.getElementById('cropYTo');
const cropYStep = document.getElementById('cropYStep');
const saveAvgDataBtn = document.getElementById('saveAvgData');


// --- 전역 상태 변수 ---
let speFrames = []; // 모든 프레임 데이터 저장
let imageWidth = 0;
let imageHeight = 0;
let currentFrameIndex = 0;
let selectedRowY = -1; // 프로필을 그릴 Y축 위치

let settingPeakLine = 0; // 0: none, 1: peak1, 2: peak2
let peakLine1X = -1;
let peakLine2X = -1;

let settingIntegralLine = 0; // 0: none, 1: integral1, 2: integral2
let integralLine1X = -1;
let integralLine2X = -1;


// --- 초기화 ---
function initialize() {
    pCtx.font = '20px sans-serif';
    pCtx.fillStyle = '#aaa';
    pCtx.textAlign = 'center';
    pCtx.fillText('Select or Drop SPE file here', previewCanvas.width / 2, previewCanvas.height / 2);

    pfCtx.font = '16px sans-serif';
    pfCtx.fillStyle = '#aaa';
    pfCtx.textAlign = 'center';
    pfCtx.fillText('Click on the image above to show a row profile', profileCanvas.width / 2, profileCanvas.height / 2);
}
initialize();


// --- 파일 처리 ---
function handleFileSelect(input) {
    if (!input.files.length) return;
    const file = input.files[0];
    parseSpeFile(file);
}

async function parseSpeFile(file) {
    try {
        const buffer = await file.arrayBuffer();
        const dataView = new DataView(buffer);

        const HEADER_SIZE = 4100;
        imageWidth = dataView.getUint16(42, true);
        imageHeight = dataView.getUint16(656, true);
        const numFrames = dataView.getUint32(1446, true);
        const dataType = dataView.getInt16(108, true);

        if (imageWidth === 0 || imageHeight === 0 || numFrames === 0) {
            alert('유효한 SPE 파일이 아닙니다.');
            return;
        }
        if (dataType !== 3) { // 16-bit unsigned integer
            alert(`지원하지 않는 데이터 타입입니다: ${dataType}`);
            return;
        }

        speFrames = [];
        const pixelsPerFrame = imageWidth * imageHeight;
        for (let i = 0; i < numFrames; i++) {
            const frameOffset = HEADER_SIZE + (i * pixelsPerFrame * 2); // 2 bytes per pixel
            const frameData = new Uint16Array(buffer, frameOffset, pixelsPerFrame);
            speFrames.push(frameData);
        }

        currentFrameIndex = 0;
        updateFrameList(numFrames);
        drawImage();

    } catch (error) {
        console.error("파일 파싱 오류:", error);
        alert("파일을 읽는 중 오류가 발생했습니다.");
    }
}


// --- UI 업데이트 ---
function updateFrameList(numFrames) {
    frameListContainer.innerHTML = '';
    for (let i = 0; i < numFrames; i++) {
        const label = document.createElement('label');
        label.className = 'frame-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.index = i;
        const text = document.createTextNode(` Frame ${i + 1}`);
        label.appendChild(checkbox);
        label.appendChild(text);
        
        // 프레임 리스트의 항목을 클릭하면 해당 프레임을 보여줌 (체크박스 클릭이 아닌)
        label.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                currentFrameIndex = i;
                drawImage();
            }
        });

        frameListContainer.appendChild(label);
    }
    avgButton.style.display = numFrames > 1 ? 'block' : 'none';
}


// --- 캔버스 드로잉 ---
function drawImage() {
    if (speFrames.length === 0) return;

    previewCanvas.addEventListener('mousemove', showPixelInfo);
    previewCanvas.addEventListener('mouseleave', () => { pixelInfo.style.display = 'none'; });

    const pixelData = speFrames[currentFrameIndex];
    const min = parseInt(rangeMin.value, 10);
    const max = parseInt(rangeMax.value, 10);

    previewCanvas.width = imageWidth;
    previewCanvas.height = imageHeight;
    const imageData = pCtx.createImageData(imageWidth, imageHeight);
    const data = imageData.data;
    const range = max - min;
    
    if (range <= 0) { // 0으로 나누기 방지 및 화면 클리어
        pCtx.clearRect(0, 0, imageWidth, imageHeight);
        return;
    }

    for (let i = 0; i < pixelData.length; i++) {
        let value = (pixelData[i] - min) / range * 255;
        value = Math.max(0, Math.min(255, value));
        const j = i * 4;
        data[j] = value;     // R
        data[j + 1] = value; // G
        data[j + 2] = value; // B
        data[j + 3] = 255;   // A
    }
    pCtx.putImageData(imageData, 0, 0);

    // 선택된 행이 있으면 선 그리기
    if (selectedRowY !== -1) {
        pCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        pCtx.fillRect(0, selectedRowY, imageWidth, 1);
        drawProfileGraph();
    }
}

function drawProfileGraph(averageProfile = null) {
    if (speFrames.length === 0 || (selectedRowY === -1 && !averageProfile)) return;

    const profileData = averageProfile ? averageProfile : speFrames[currentFrameIndex].slice(selectedRowY * imageWidth, (selectedRowY + 1) * imageWidth);

    pfCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    
    // Y축 범위 계산
    let minVal = profileData[0], maxVal = profileData[0];
    for(let i=1; i<profileData.length; i++) {
        if(profileData[i] < minVal) minVal = profileData[i];
        if(profileData[i] > maxVal) maxVal = profileData[i];
    }
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    // 그래프 그리기
    pfCtx.beginPath();
    pfCtx.strokeStyle = 'green';
    pfCtx.lineWidth = 2;

    for (let x = 0; x < profileData.length; x++) {
        const canvasX = (x / (profileData.length - 1)) * profileCanvas.width;
        const canvasY = (1 - (profileData[x] - minVal) / range) * (profileCanvas.height - 20) + 10; // 상하 여백
        if (x === 0) {
            pfCtx.moveTo(canvasX, canvasY);
        } else {
            pfCtx.lineTo(canvasX, canvasY);
        }
    }
    pfCtx.stroke();

    // 분석용 라인 그리기
    const drawLine = (x, color) => {
        if (x === -1) return;
        const canvasX = (x / (imageWidth - 1)) * profileCanvas.width;
        pfCtx.beginPath();
        pfCtx.strokeStyle = color;
        pfCtx.lineWidth = 1;
        pfCtx.moveTo(canvasX, 0);
        pfCtx.lineTo(canvasX, profileCanvas.height);
        pfCtx.stroke();
    };

    drawLine(peakLine1X, 'blue');
    drawLine(peakLine2X, 'orange');
    drawLine(integralLine1X, 'gold');
    drawLine(integralLine2X, 'gold');
}

// --- 이벤트 리스너 ---
rangeMin.addEventListener('input', () => {
    rangeMinDisplay.textContent = rangeMin.value;
    drawImage();
});
rangeMax.addEventListener('input', () => {
    rangeMaxDisplay.textContent = rangeMax.value;
    drawImage();
});

previewCanvas.addEventListener('click', (e) => {
    const rect = previewCanvas.getBoundingClientRect();
    const scaleX = previewCanvas.width / rect.width;
    const y = Math.round((e.clientY - rect.top) * scaleX);

    if (y >= 0 && y < imageHeight) {
        selectedRowY = y;
        drawImage(); // 선택된 선을 다시 그리기 위함
    }
});

profileCanvas.addEventListener('click', (e) => {
    const rect = profileCanvas.getBoundingClientRect();
    const scaleX = imageWidth / rect.width;
    const x = Math.round((e.clientX - rect.left) * scaleX);

    if (settingPeakLine === 1) peakLine1X = x;
    else if (settingPeakLine === 2) peakLine2X = x;
    
    if (settingIntegralLine === 1) integralLine1X = x;
    else if (settingIntegralLine === 2) integralLine2X = x;

    settingPeakLine = 0;
    settingIntegralLine = 0;
    
    updateAnalysis();
    drawProfileGraph(); // 라인 그린 후 그래프 갱신
});

setPeak1Btn.addEventListener('click', () => settingPeakLine = 1);
setPeak2Btn.addEventListener('click', () => settingPeakLine = 2);
setIntegral1Btn.addEventListener('click', () => settingIntegralLine = 1);
setIntegral2Btn.addEventListener('click', () => settingIntegralLine = 2);

avgButton.addEventListener('click', () => {
    const checkedIndexes = [...frameListContainer.querySelectorAll('input[type=checkbox]:checked')].map(cb => parseInt(cb.dataset.index));
    
    if (checkedIndexes.length === 0) {
        alert("평균을 계산할 프레임을 하나 이상 선택하세요.");
        return;
    }

    const avgProfile = new Float32Array(imageWidth).fill(0);
    const profileData = speFrames[0].slice(selectedRowY * imageWidth, (selectedRowY + 1) * imageWidth);

    for (let i = 0; i < imageWidth; i++) {
        let sum = 0;
        for (const frameIdx of checkedIndexes) {
            sum += speFrames[frameIdx][selectedRowY * imageWidth + i];
        }
        avgProfile[i] = sum / checkedIndexes.length;
    }
    drawProfileGraph(avgProfile);
});

saveAvgDataBtn.addEventListener('click', () => {
    if (speFrames.length === 0) return alert("먼저 파일을 불러오세요.");

    const xFrom = parseInt(cropXFrom.value);
    const xTo = parseInt(cropXTo.value);
    const xStep = parseInt(cropXStep.value);
    const yFrom = parseInt(cropYFrom.value);
    const yTo = parseInt(cropYTo.value);
    const yStep = parseInt(cropYStep.value);

    if ([xFrom, xTo, xStep, yFrom, yTo, yStep].some(isNaN)) {
        return alert("모든 From, To, Step 값을 입력해주세요.");
    }

    let textContent = "X_center,Y_center,Average_Value\n";
    const frameData = speFrames[currentFrameIndex];

    for (let y = yFrom; y < yTo; y += yStep) {
        for (let x = xFrom; x < xTo; x += xStep) {
            let sum = 0;
            let count = 0;
            for (let j = y; j < y + yStep && j < yTo && j < imageHeight; j++) {
                for (let i = x; i < x + xStep && i < xTo && i < imageWidth; i++) {
                    sum += frameData[j * imageWidth + i];
                    count++;
                }
            }
            if (count > 0) {
                const avg = sum / count;
                const centerX = x + xStep / 2;
                const centerY = y + yStep / 2;
                textContent += `${centerX},${centerY},${avg.toFixed(2)}\n`;
            }
        }
    }
    
    downloadTextFile("average_data.txt", textContent);
});

// ▼▼▼ Min/Max 제어 로직 수정 ▼▼▼
function syncMinMax(source) {
    let minVal = parseInt(rangeMinInput.value, 10);
    let maxVal = parseInt(rangeMaxInput.value, 10);

    // 유효하지 않은 값 보정
    if (isNaN(minVal)) minVal = 0;
    if (isNaN(maxVal)) maxVal = 65535;

    if (minVal >= maxVal) {
        if (source === 'min') {
            minVal = maxVal - 1;
        } else {
            maxVal = minVal + 1;
        }
    }
    
    // 값 범위 제한
    minVal = Math.max(0, Math.min(65534, minVal));
    maxVal = Math.max(1, Math.min(65535, maxVal));
    
    // 모든 입력 요소에 값 동기화
    rangeMin.value = minVal;
    rangeMinInput.value = minVal;
    rangeMax.value = maxVal;
    rangeMaxInput.value = maxVal;

    drawImage();
}

rangeMin.addEventListener('input', () => syncMinMax('min'));
rangeMinInput.addEventListener('input', () => syncMinMax('min'));
rangeMax.addEventListener('input', () => syncMinMax('max'));
rangeMaxInput.addEventListener('input', () => syncMinMax('max'));
// ▲▲▲ Min/Max 제어 로직 수정 ▲▲▲


// ▼▼▼ 픽셀 정보 표시 함수 추가 ▼▼▼
function showPixelInfo(e) {
    if (speFrames.length === 0) return;

    const rect = previewCanvas.getBoundingClientRect();
    const scaleX = previewCanvas.width / rect.width;
    const scaleY = previewCanvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
        const pixelIndex = y * imageWidth + x;
        const pixelValue = speFrames[currentFrameIndex][pixelIndex];
        
        pixelInfo.style.display = 'block';
        pixelInfo.textContent = `X: ${x}, Y: ${y}, Value: ${pixelValue}`;
    } else {
        pixelInfo.style.display = 'none';
    }
}
// ▲▲▲ 픽셀 정보 표시 함수 추가 ▲▲▲


previewCanvas.addEventListener('click', (e) => {
    const rect = previewCanvas.getBoundingClientRect();
    const scaleY = previewCanvas.height / rect.height; // scaleX -> scaleY 로 수정
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (y >= 0 && y < imageHeight) {
        selectedRowY = y;
        drawImage();
    }
});

// --- 분석 계산 ---
function updateAnalysis() {
    // Peak 계산
    if (peakLine1X !== -1 && peakLine2X !== -1) {
        const delta = Math.abs(peakLine1X - peakLine2X);
        const center = (peakLine1X + peakLine2X) / 2;
        peakDeltaDisplay.textContent = delta;
        peakCenterDisplay.textContent = center.toFixed(2);
    }

    // Integral 계산
    if (integralLine1X !== -1 && integralLine2X !== -1 && selectedRowY !== -1) {
        const profileData = speFrames[currentFrameIndex].slice(selectedRowY * imageWidth, (selectedRowY + 1) * imageWidth);
        const start = Math.min(integralLine1X, integralLine2X);
        const end = Math.max(integralLine1X, integralLine2X);
        let sum = 0;
        for (let i = start; i <= end; i++) {
            sum += profileData[i];
        }
        integralValueDisplay.textContent = sum.toExponential(3); // 과학적 표기법
    }
}


// --- 헬퍼 함수 ---
function downloadTextFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

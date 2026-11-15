(function(){const MIN_CASES_PER_DAY=2, MAX_CASES_PER_DAY=5;
const COMPANY_POOL = [
  { name:"해원건설산업(주)", type:"임시 교량 자재 납품", qty:"강재 모듈 200개 / 7일 이내", amountRange:[5,10],
    valid:true, verdictReason:"설립 10년, 실적 다수, 야적장/인력 실존 확인", supplierId:"supplier-a",
    clues:{ registry:{text:"설립 2015년, 자본금 8억, 최근 5년 공사 실적 12건. 특이사항 없음.",suspicious:false},
            roadview:{text:"등록 주소지에 실제 자재 야적장·사무동 존재, 중장비 다수 확인.",suspicious:false},
            phone:{text:"담당자가 납기·보유 자재 규격을 정확히 설명.",suspicious:false} },
    note:"정상 납품 시 구호 자재 공급 안정화에 기여" },

  { name:"미래복구기술(주)", type:"복구 장비 임대", qty:"굴삭기 3대 / 5일 이내", amountRange:[2,4],
    valid:false, verdictReason:"설립 2개월, 공유오피스 주소, 장비 보관 흔적 없음, 담당자 회피", supplierId:"supplier-b",
    clues:{ registry:{text:"설립 2개월 전, 본점 소재지가 공유오피스로 등록.",suspicious:true},
            roadview:{text:"등록 주소는 개인 원룸 건물, 장비 보관 흔적 전혀 없음.",suspicious:true},
            phone:{text:"담당자가 보유 장비 목록 질문에 즉답을 피하고 말을 돌림.",suspicious:true} },
    note:"승인 시 장비 미납 리스크 발생" },

  { name:"동남물류유통", type:"생수·의료물품 긴급 운송", qty:"생수 5,000병 / 당일", amountRange:[0.5,1],
    valid:true, verdictReason:"실적 보유, 물류창고·냉장 탑차 실존, 운송 동선 구체적 설명", supplierId:"supplier-c",
    clues:{ registry:{text:"설립 7년차, 조달청 납품 이력 3건.",suspicious:false},
            roadview:{text:"소형 물류창고와 냉장 탑차 2대 확인.",suspicious:false},
            phone:{text:"긴급 운송 동선·소요 시간을 구체적으로 안내.",suspicious:false} },
    note:"정상 승인 시 고립 지역 구호물품 도달률 상승" },

  { name:"그린브릿지건설", type:"도로 복구 자재 납품", qty:"콘크리트 패널 150개 / 3일 이내", amountRange:[2.5,4.5],
    valid:false, verdictReason:"동일 대표자 반복 설립 패턴, 간판 불일치, 소속 미확인", supplierId:"supplier-d",
    clues:{ registry:{text:"동일 대표자가 유사 상호의 폐업 업체 2곳과 연관됨.",suspicious:true},
            roadview:{text:"등록 주소에 '그린브릿지' 간판 없음, 다른 업체 간판만 확인.",suspicious:true},
            phone:{text:"응답자가 회사 소속을 제대로 밝히지 못함.",suspicious:true} },
    note:"승인 시 도로 복구 지연 리스크" },

  { name:"한빛통신장비", type:"이동형 통신장비 공급", qty:"이동형 기지국 10대 / 2일 이내", amountRange:[0.7,1.2],
    valid:true, verdictReason:"설립 10년, 통신장비 전문 제조업 등록, 재고·설치인력 확인됨", supplierId:"supplier-e",
    clues:{ registry:{text:"설립 10년, 통신장비 전문 제조업 등록, 특이사항 없음.",suspicious:false},
            roadview:{text:"등록 주소에 공장 및 물류 출입구 확인됨.",suspicious:false},
            phone:{text:"재고 수량과 설치 인력 배치 계획을 명확히 제시함.",suspicious:false} },
    note:"정상 승인 시 고립지역 통신 복구에 기여" },

  { name:"신속교량산업", type:"임시 교량 설치 자재", qty:"강재 모듈 80개 / 2일 이내", amountRange:[2,3.2],
    valid:false, verdictReason:"설립 1개월, 교량 시공 실적 전무, 하도급 재하도급 구조 의심", supplierId:"supplier-f",
    clues:{ registry:{text:"설립 1개월 전, 교량·토목 관련 시공 실적이 전혀 없음.",suspicious:true},
            roadview:{text:"등록 주소는 소규모 사무실, 자재 보관 공간 없음.",suspicious:true},
            phone:{text:"견적 근거를 묻자 '하도급 업체가 처리한다'며 답변 회피.",suspicious:true} },
    note:"승인 시 임시 보급로 추가 손상 리스크" },

  { name:"청솔의료물류", type:"응급 의료물품 긴급 납품", qty:"응급키트 3,000세트 / 당일", amountRange:[0.8,1.5],
    valid:true, verdictReason:"의료물류 전문 업체, 응급 대응 이력 다수, 재고 실사 가능", supplierId:"supplier-g",
    clues:{ registry:{text:"설립 8년, 의료물류 전문 등록, 재난 대응 납품 이력 2건.",suspicious:false},
            roadview:{text:"냉장·멸균 보관시설을 갖춘 물류센터 확인.",suspicious:false},
            phone:{text:"재고 수량과 포장·배송 계획을 즉시 제시함.",suspicious:false} },
    note:"정상 승인 시 의료 지원 체계 안정화" },

  { name:"대한재난테크", type:"임시 대피시설 패널 납품", qty:"조립식 패널 500매 / 1일 이내", amountRange:[1.5,2.5],
    valid:false, verdictReason:"허위 납품 실적 제출 의심, 서류 양식이 다른 낙찰 취소 업체와 일치", supplierId:"supplier-h",
    clues:{ registry:{text:"제출된 과거 납품 실적이 발주처에 등록되지 않은 허위 기록으로 확인됨.",suspicious:true},
            roadview:{text:"등록 주소는 공사 중단된 건물로 운영 흔적 없음.",suspicious:true},
            phone:{text:"납품 실적 관련 질문에 번호가 결번 처리되어 연결되지 않음.",suspicious:true} },
    note:"승인 시 대피시설 추가 피해 리스크" },

  { name:"태양광물자지원", type:"비상 발전기·태양광 패널 공급", qty:"발전기 15대 / 2일 이내", amountRange:[1.2,2.0],
    valid:true, verdictReason:"재생에너지 설비 전문 업체, 설치 이력 풍부, 재고 실물 확인", supplierId:"supplier-i",
    clues:{ registry:{text:"설립 6년, 재생에너지 설비 공급업 등록, 특이사항 없음.",suspicious:false},
            roadview:{text:"창고에 발전기·패널 재고 다수 확인됨.",suspicious:false},
            phone:{text:"설치 기사 인원과 작업 순서를 구체적으로 설명.",suspicious:false} },
    note:"정상 승인 시 고립지역 전력 공급 안정화" },

  { name:"늘푸른자원개발", type:"구호소 식자재 공급", qty:"비상식량 10,000인분 / 1일 이내", amountRange:[0.6,1.1],
    valid:false, verdictReason:"위생 허가 미보유, 보관시설 부적합, 납품 단가 비정상적으로 낮음", supplierId:"supplier-j",
    clues:{ registry:{text:"식품 관련 위생 허가가 등록되어 있지 않음.",suspicious:true},
            roadview:{text:"등록 주소는 일반 가정집으로 식자재 보관시설이 없음.",suspicious:true},
            phone:{text:"보관 온도·유통기한 관리 방식에 대한 질문에 답변하지 못함.",suspicious:true} },
    note:"승인 시 식중독 등 2차 피해 리스크" },

  { name:"스마트드론테크", type:"재난 물자 운송 드론 지원", qty:"운송 드론 8대 / 3일 이내", amountRange:[1.0,1.8],
    valid:true, verdictReason:"혁신조달 시범구매 이력 보유, 비행 테스트 영상 확인 가능", supplierId:"supplier-k",
    clues:{ registry:{text:"설립 4년, 혁신제품 지정 이력 있음, 기술 특허 2건 보유.",suspicious:false},
            roadview:{text:"드론 이착륙장과 정비시설이 갖춰진 사업장 확인.",suspicious:false},
            phone:{text:"기체 적재중량·운용 가능 거리 등을 정확히 답변.",suspicious:false} },
    note:"정상 승인 시 고립지역 긴급 물자 공중 수송 가능" },

  { name:"한솔임시주택", type:"이재민 임시주택 자재 공급", qty:"조립식 주택 모듈 40세트 / 4일 이내", amountRange:[3.0,5.0],
    valid:false, verdictReason:"법인 설립 직후 대표 변경 반복, 실제 생산시설 확인 불가", supplierId:"supplier-l",
    clues:{ registry:{text:"최근 6개월 내 대표자가 3차례 변경됨.",suspicious:true},
            roadview:{text:"등록 주소는 빈 상가로 생산·보관 흔적이 없음.",suspicious:true},
            phone:{text:"모듈 제작 공장 위치를 묻자 답변을 계속 미룸.",suspicious:true} },
    note:"승인 시 임시주택 미납·품질 문제 발생" }
];

function pick(arr,n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]] = [copy[j],copy[i]];
  }
  return copy.slice(0,n);
}
function randRange([min,max]){ return Math.round((min + Math.random()*(max-min)) * 10) / 10; }
function makeId(name, day){ return (name.replace(/[^가-힣a-zA-Z0-9]/g,'') + '-' + day + '-' + Math.random().toString(36).slice(2,6)); }

function generateDay(day){
  const count = MIN_CASES_PER_DAY + Math.floor(Math.random()*(MAX_CASES_PER_DAY-MIN_CASES_PER_DAY+1));
  const templates = pick(COMPANY_POOL, count);
  return templates.map(t => {
    const amount = randRange(t.amountRange);
    return {
      id: makeId(t.name, day),
      name: t.name, type: t.type, qty: t.qty, amount,
      valid: t.valid, verdictReason: t.verdictReason, clues: t.clues,
      followUp: { supplierId: t.supplierId, expectedDeliveryDay: day+1, note: t.note }
    };
  });
}


window.ContractData={generateDay};})();
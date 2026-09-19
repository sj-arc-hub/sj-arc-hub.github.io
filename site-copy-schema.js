// Editable public homepage content. Field structure is shared by the editor and renderer.
export const copyFields = [
  {
    "key": "hero.eyebrow",
    "label": "상단 영문 소개",
    "group": "첫 화면",
    "type": "text",
    "max": 100,
    "default": "SEJONG CYBER UNIV. DRONE CLUB"
  },
  {
    "key": "hero.title",
    "label": "메인 제목 (줄바꿈 가능)",
    "group": "첫 화면",
    "type": "text",
    "max": 100,
    "default": "함께 만들고,\n함께 날리는 우리."
  },
  {
    "key": "hero.description",
    "label": "동아리 소개",
    "group": "첫 화면",
    "type": "text",
    "max": 500,
    "default": "단순 조종을 넘어 드론의 두뇌를 설계합니다. 직접 기체를 제작하고 ROS2 기반 자율비행을 배우는 세종사이버대학교 실전 메이커 동아리입니다."
  },
  {
    "key": "hero.joinLabel",
    "label": "첫 화면 가입 버튼",
    "group": "첫 화면",
    "type": "text",
    "max": 40,
    "default": "동아리 가입 신청"
  },
  {
    "key": "hero.galleryLabel",
    "label": "첫 화면 활동 버튼",
    "group": "첫 화면",
    "type": "text",
    "max": 40,
    "default": "활동 둘러보기"
  },
  {
    "key": "intro.build.title",
    "label": "소개 제목 · 직접 만드는 드론",
    "group": "동아리 소개",
    "type": "text",
    "max": 80,
    "default": "직접 만드는 드론"
  },
  {
    "key": "intro.build.description",
    "label": "설명 · 직접 만드는 드론",
    "group": "동아리 소개",
    "type": "text",
    "max": 500,
    "default": "설계부터 조립, 납땜, 기초 세팅까지 내 손으로 기체를 빌드업합니다."
  },
  {
    "key": "intro.study.title",
    "label": "소개 제목 · 함께 배우는 자율비행",
    "group": "동아리 소개",
    "type": "text",
    "max": 80,
    "default": "함께 배우는 자율비행"
  },
  {
    "key": "intro.study.description",
    "label": "설명 · 함께 배우는 자율비행",
    "group": "동아리 소개",
    "type": "text",
    "max": 500,
    "default": "PX4, ROS2를 활용해 스스로 판단하고 비행하는 지능형 시스템을 스터디합니다."
  },
  {
    "key": "intro.meet.title",
    "label": "소개 제목 · 격주 토요일 정기모임",
    "group": "동아리 소개",
    "type": "text",
    "max": 80,
    "default": "격주 토요일 정기모임"
  },
  {
    "key": "intro.meet.description",
    "label": "설명 · 격주 토요일 정기모임",
    "group": "동아리 소개",
    "type": "text",
    "max": 500,
    "default": "무방관에서 모여 실력을 다지고, 광나루 드론 공원에서 비행을 실습합니다."
  },
  {
    "key": "activities.eyebrow",
    "label": "활동 영문 소제목",
    "group": "주요 활동",
    "type": "text",
    "max": 60,
    "default": "OUR CLUB LIFE"
  },
  {
    "key": "activities.title",
    "label": "활동 제목",
    "group": "주요 활동",
    "type": "text",
    "max": 100,
    "default": "토요일마다, 한 걸음 더."
  },
  {
    "key": "activities.build.title",
    "label": "활동 이름 · 기체 제작",
    "group": "주요 활동",
    "type": "text",
    "max": 80,
    "default": "기체 제작"
  },
  {
    "key": "activities.build.description",
    "label": "활동 설명 · 기체 제작",
    "group": "주요 활동",
    "type": "text",
    "max": 500,
    "default": "설계부터 납땜과 세팅까지, 내 손으로 드론을 만듭니다."
  },
  {
    "key": "activities.fly.title",
    "label": "활동 이름 · 비행 실습",
    "group": "주요 활동",
    "type": "text",
    "max": 80,
    "default": "비행 실습"
  },
  {
    "key": "activities.fly.description",
    "label": "활동 설명 · 비행 실습",
    "group": "주요 활동",
    "type": "text",
    "max": 500,
    "default": "경로 비행과 파라미터 튜닝으로 기체를 이해합니다."
  },
  {
    "key": "activities.study.title",
    "label": "활동 이름 · 함께하는 기술 공부",
    "group": "주요 활동",
    "type": "text",
    "max": 80,
    "default": "함께하는 기술 공부"
  },
  {
    "key": "activities.study.description",
    "label": "활동 설명 · 함께하는 기술 공부",
    "group": "주요 활동",
    "type": "text",
    "max": 500,
    "default": "ROS2 스터디와 코드 리뷰로 지식을 나눕니다."
  },
  {
    "key": "activities.challenge.title",
    "label": "활동 이름 · 대회와 프로젝트",
    "group": "주요 활동",
    "type": "text",
    "max": 80,
    "default": "대회와 프로젝트"
  },
  {
    "key": "activities.challenge.description",
    "label": "활동 설명 · 대회와 프로젝트",
    "group": "주요 활동",
    "type": "text",
    "max": 500,
    "default": "배운 기술을 연결해 다음 도전을 준비합니다."
  },
  {
    "key": "tracks.title",
    "label": "트랙 소개 제목",
    "group": "성장 트랙",
    "type": "text",
    "max": 100,
    "default": "성장을 위한 2개의 트랙"
  },
  {
    "key": "tracks.description",
    "label": "트랙 소개 설명",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "조종과 기체 운영에 집중하는 트랙, 알고리즘과 소프트웨어를 다루는 트랙. 초보자도 체계적으로 배울 수 있습니다."
  },
  {
    "key": "tracks.op1.title",
    "label": "단계 제목 · 기초 제작 및 수동 비행",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "기초 제작 및 수동 비행"
  },
  {
    "key": "tracks.op1.description",
    "label": "단계 설명 · 기초 제작 및 수동 비행",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "기체 부품 이해, 조립, 펌웨어 업로드 및 수동 조종 숙달"
  },
  {
    "key": "tracks.op2.title",
    "label": "단계 제목 · 자율 미션 및 튜닝",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "자율 미션 및 튜닝"
  },
  {
    "key": "tracks.op2.description",
    "label": "단계 설명 · 자율 미션 및 튜닝",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "GCS를 활용한 웨이포인트 비행, PID 파라미터 세밀 튜닝"
  },
  {
    "key": "tracks.op3.title",
    "label": "단계 제목 · 시스템 통합 마스터",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "시스템 통합 마스터"
  },
  {
    "key": "tracks.op3.description",
    "label": "단계 설명 · 시스템 통합 마스터",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "특수 목적 커스텀 기체 설계 및 카메라/센서 페이로드 연동"
  },
  {
    "key": "tracks.dev1.title",
    "label": "단계 제목 · 개발 환경 구축",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "개발 환경 구축"
  },
  {
    "key": "tracks.dev1.description",
    "label": "단계 설명 · 개발 환경 구축",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "Ubuntu, ROS2, PX4 툴체인 및 Gazebo 시뮬레이터 세팅"
  },
  {
    "key": "tracks.dev2.title",
    "label": "단계 제목 · 알고리즘 구현",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "알고리즘 구현"
  },
  {
    "key": "tracks.dev2.description",
    "label": "단계 설명 · 알고리즘 구현",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "센서 데이터 처리 및 ROS2 노드 기반 제어 알고리즘 작성"
  },
  {
    "key": "tracks.dev3.title",
    "label": "단계 제목 · 실환경 적용",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "실환경 적용"
  },
  {
    "key": "tracks.dev3.description",
    "label": "단계 설명 · 실환경 적용",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "구현 로직을 실제 동반 컴퓨터(SBC)에 탑재하여 실비행 검증"
  },
  {
    "key": "tracks.dev4.title",
    "label": "단계 제목 · 코어 커스터마이징",
    "group": "성장 트랙",
    "type": "text",
    "max": 80,
    "default": "코어 커스터마이징"
  },
  {
    "key": "tracks.dev4.description",
    "label": "단계 설명 · 코어 커스터마이징",
    "group": "성장 트랙",
    "type": "text",
    "max": 500,
    "default": "비행 제어기(FC) 펌웨어 로직 수정 및 독자 모듈 개발"
  },
  {
    "key": "projects.title",
    "label": "프로젝트 제목",
    "group": "프로젝트",
    "type": "text",
    "max": 100,
    "default": "도전하는 학습 프로젝트"
  },
  {
    "key": "projects.vision.title",
    "label": "비전 프로젝트 이름",
    "group": "프로젝트",
    "type": "text",
    "max": 80,
    "default": "비전 기반 객체 추적"
  },
  {
    "key": "projects.vision.description",
    "label": "비전 프로젝트 설명",
    "group": "프로젝트",
    "type": "text",
    "max": 500,
    "default": "카메라 영상을 실시간으로 분석해 목표물을 인식하고 일정한 거리를 유지하며 따라가는 지능형 팔로잉 기술 스터디."
  },
  {
    "key": "projects.path.title",
    "label": "경로 프로젝트 이름",
    "group": "프로젝트",
    "type": "text",
    "max": 80,
    "default": "자율 경로 주행"
  },
  {
    "key": "projects.path.description",
    "label": "경로 프로젝트 설명",
    "group": "프로젝트",
    "type": "text",
    "max": 500,
    "default": "바닥의 라인이나 마커를 스스로 스캔하고 판단하여 최적의 경로로 정밀하게 이동하는 패스 팔로잉 미션."
  },
  {
    "key": "join.title",
    "label": "가입 안내 제목",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 100,
    "default": "가입 안내"
  },
  {
    "key": "join.description",
    "label": "가입 안내 설명",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 500,
    "default": "첫 기체 제작부터 자율비행 프로젝트까지, 함께 배웁니다.\n함께 배우고 성장할 동아리원을 기다립니다."
  },
  {
    "key": "join.meeting",
    "label": "모임 장소와 시간",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 500,
    "default": "세종사이버대학교 무방관\n격주 토요일 오전 10시 정기모임\n(비행 실습: 광나루 드론 공원)"
  },
  {
    "key": "join.fee",
    "label": "회비",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 100,
    "default": "학기당 100,000원"
  },
  {
    "key": "join.feeNote",
    "label": "회비 설명",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 300,
    "default": "※ 활동비·재료비·대회 참가비 포함"
  },
  {
    "key": "join.button",
    "label": "하단 가입 버튼",
    "group": "가입·모임 안내",
    "type": "text",
    "max": 40,
    "default": "가입 신청서 작성하기"
  },
  {
    "key": "footer.description",
    "label": "하단 동아리 소개",
    "group": "하단 소개",
    "type": "text",
    "max": 300,
    "default": "세종사이버대학교 드론 제작·운영 동아리\n서울시 광진구 무방관 · sj-arc.org"
  },
  {
    "key": "links.join",
    "label": "가입 신청서",
    "group": "연결 주소",
    "type": "url",
    "max": 1500,
    "default": "https://forms.gle/tCWkZqtovFibKZ4KA"
  },
  {
    "key": "links.discord",
    "label": "디스코드",
    "group": "연결 주소",
    "type": "url",
    "max": 1500,
    "default": "https://discord.gg/w3qv3dvzQN"
  },
  {
    "key": "links.github",
    "label": "GitHub",
    "group": "연결 주소",
    "type": "url",
    "max": 1500,
    "default": "https://github.com/sj-arc-hub"
  },
  {
    "key": "links.notion",
    "label": "Notion",
    "group": "연결 주소",
    "type": "url",
    "max": 1500,
    "default": "https://gold-spark-83c.notion.site/SJ-ON-Project-Hub-2df8ca9f94bc804796e1e46807a6a215?pvs=74"
  }
];

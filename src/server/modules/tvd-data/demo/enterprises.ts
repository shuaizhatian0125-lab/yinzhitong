/**
 * TVD 演示企业语料 —— 真实企业名称与主导产品。
 *
 * 来源：工业和信息化部第一批专精特新"小巨人"企业名单（2019 年，248 家）。
 * 本文件只收录该名单中可核对的两项事实：企业名称、名单标注的主导产品，
 * 以及由名称/公示口径得到的省市归属。
 *
 * 数据分级（PRD 第十三章 / TVD-08）：
 *   REAL_DATA       —— name、product、region、qualifications（名单本身即官方认定）
 *   AI_INFERENCE    —— industry、track、techKeywords（由主导产品归并出的分类判断）
 *   SYNTHETIC_DATA  —— 专利、研发、财务、订单等全部数值，由 seed 的确定性伪随机
 *                      生成，仅用于演示算法与界面，不代表任何真实经营状况
 *
 * 名单原文存在若干转录错字（如"数提技术""艾可篮""喷涂肢显影"），
 * 已按企业工商登记名订正；订正后的名称与原文差异记录在 seed 的来源说明里。
 *
 * 抓取地址与抓取时间见 SOURCES，unified_code 一律留空而不编造 18 位代码。
 */

export type DemoEnterpriseSeed = {
  /** 名单原文企业名称（已订正转录错字）。 */
  name: string;
  /** 名单标注的主导产品，原文照录。 */
  product: string;
  /** 省级归属。 */
  region: string;
  /** 地市，仅在企业名或名单可直接确定时填写，否则 null。 */
  city: string | null;
  /** 归并行业 —— 推断。 */
  industry: string;
  /** 赛道 —— 推断。 */
  track: string;
  /** 技术关键词 —— 推断。 */
  keywords: string[];
  /** 名单批次。 */
  batch: number;
};

export const DEMO_ENTERPRISES: DemoEnterpriseSeed[] = [
  { name: '北京卓立汉光仪器有限公司', product: '精密光学机械移动及控制组件', region: '北京市', city: '北京市', industry: '光学光电子', track: '科学仪器', keywords: ['精密运动控制', '光谱仪器', '光学平台'], batch: 1 },
  { name: '北京康普锡威科技有限公司', product: '微电子互连用合金焊粉', region: '北京市', city: '北京市', industry: '新材料', track: '电子焊料', keywords: ['低温焊料', '粉末冶金', '互连材料'], batch: 1 },
  { name: '北京品驰医疗设备有限公司', product: '脑起搏器', region: '北京市', city: '北京市', industry: '生物医药与医疗器械', track: '植入式医疗器械', keywords: ['神经调控', '植入式器件', '长寿命电池'], batch: 1 },
  { name: '北京凯普林光电科技股份有限公司', product: '高功率半导体激光器', region: '北京市', city: '北京市', industry: '光学光电子', track: '激光器件', keywords: ['半导体激光器', '光纤耦合', '泵浦源'], batch: 1 },
  { name: '瑞普（天津）生物药业有限公司', product: '兽用原料药及药物制剂', region: '天津市', city: '天津市', industry: '生物医药与医疗器械', track: '动物保健', keywords: ['兽用制剂', '发酵工艺', '药物合成'], batch: 1 },
  { name: '天津南大通用数据技术股份有限公司', product: 'GBase 数据库', region: '天津市', city: '天津市', industry: '软件与信息技术', track: '国产数据库', keywords: ['分析型数据库', 'SQL 引擎', '分布式存储'], batch: 1 },
  { name: '天津久日新材料股份有限公司', product: '光引发剂 TPO', region: '天津市', city: '天津市', industry: '新材料', track: '光固化材料', keywords: ['光引发剂', 'UV 固化', '精细化工'], batch: 1 },
  { name: '天津同仁堂集团股份有限公司', product: '肾炎康复片', region: '天津市', city: '天津市', industry: '生物医药与医疗器械', track: '现代中药', keywords: ['中成药', '质量标准', '制剂工艺'], batch: 1 },
  { name: '天津移山工程机械有限公司', product: '推土机', region: '天津市', city: '天津市', industry: '高端装备制造', track: '工程机械', keywords: ['传动系统', '整机设计', '重型装备'], batch: 1 },
  { name: '恒润集团有限公司', product: '预应力钢筒混凝土管', region: '天津市', city: null, industry: '高端装备制造', track: '金属成形与管道', keywords: ['大型锻件', '风电塔筒', '压力容器'], batch: 1 },
  { name: '河北华发教育科技股份有限公司', product: '红外触摸一体机', region: '河北省', city: null, industry: '光学光电子', track: '教育信息化硬件', keywords: ['红外触控', '交互终端', '嵌入式系统'], batch: 1 },
  { name: '河北润农节水科技股份有限公司', product: '农用机械和自动化控制系统', region: '河北省', city: null, industry: '高端装备制造', track: '节水灌溉', keywords: ['滴灌', '水肥一体', '农田自动化'], batch: 1 },
  { name: '沈阳芯源微电子设备有限公司', product: '半导体涂胶显影、单片湿法处理设备', region: '辽宁省', city: '沈阳市', industry: '半导体与集成电路', track: '半导体设备', keywords: ['涂胶显影', '湿法清洗', '光刻工艺'], batch: 1 },
  { name: '朝阳佛瑞达科技有限公司', product: '多层共挤高阻隔膜', region: '辽宁省', city: '朝阳市', industry: '新材料', track: '功能薄膜', keywords: ['多层共挤', '高阻隔', '包装膜'], batch: 1 },
  { name: '中科新松有限公司', product: '协作机器人', region: '上海市', city: '上海市', industry: '高端装备制造', track: '工业机器人', keywords: ['协作机器人', '力控', '安全传感'], batch: 1 },
  { name: '上海景峰制药有限公司', product: '玻璃酸钠注射液', region: '上海市', city: '上海市', industry: '生物医药与医疗器械', track: '注射剂', keywords: ['骨科注射', '无菌制剂', '缓释'], batch: 1 },
  { name: '上海宏力达信息技术股份有限公司', product: '智能电网开关及在线监测系统', region: '上海市', city: '上海市', industry: '智能电网', track: '配电自动化', keywords: ['柱上开关', '故障指示', '在线监测'], batch: 1 },
  { name: '上海同臣环保有限公司', product: '叠螺式污泥脱水机、超高压弹性压榨机', region: '上海市', city: '上海市', industry: '节能环保', track: '污泥处理装备', keywords: ['叠螺脱水', '固液分离', '环保装备'], batch: 1 },
  { name: '上海新阳半导体材料股份有限公司', product: '芯片铜互连超高纯电镀液', region: '上海市', city: '上海市', industry: '半导体与集成电路', track: '电子化学品', keywords: ['电镀液', '铜互连', '超高纯试剂'], batch: 1 },
  { name: '上海凯利泰医疗科技股份有限公司', product: '椎体扩张球囊导管', region: '上海市', city: '上海市', industry: '生物医药与医疗器械', track: '介入耗材', keywords: ['球囊导管', '骨水泥', '微创介入'], batch: 1 },
  { name: '上海微创心脉医疗科技股份有限公司', product: '主动脉介入产品', region: '上海市', city: '上海市', industry: '生物医药与医疗器械', track: '血管介入', keywords: ['覆膜支架', '主动脉夹层', '介入器械'], batch: 1 },
  { name: '上海波汇科技有限公司', product: '分布式光纤测温系统', region: '上海市', city: '上海市', industry: '光学光电子', track: '光纤传感', keywords: ['DTS', '拉曼散射', '管线监测'], batch: 1 },
  { name: '上海形状记忆合金材料有限公司', product: '先天性心脏病缺损封堵系统', region: '上海市', city: '上海市', industry: '生物医药与医疗器械', track: '植入介入', keywords: ['形状记忆合金', '封堵器', '镍钛合金'], batch: 1 },
  { name: '南通星球石墨设备有限公司', product: '组合式副产蒸汽石墨氯化氢合成炉', region: '江苏省', city: '南通市', industry: '高端装备制造', track: '石墨化工装备', keywords: ['合成炉', '余热回收', '防腐蚀'], batch: 1 },
  { name: '江苏久吾高科技股份有限公司', product: '陶瓷滤膜及成套装备', region: '江苏省', city: null, industry: '节能环保', track: '膜分离', keywords: ['陶瓷膜', '分离纯化', '水处理'], batch: 1 },
  { name: '江苏天瑞仪器股份有限公司', product: '能量色散 X 射线荧光光谱仪', region: '江苏省', city: '昆山市', industry: '高端装备制造', track: '分析仪器', keywords: ['XRF', '元素分析', '光谱'], batch: 1 },
  { name: '苏州苏试实验集团股份有限公司', product: '力学环境试验设备', region: '江苏省', city: '苏州市', industry: '高端装备制造', track: '环境试验', keywords: ['振动台', '高低温箱', '可靠性'], batch: 1 },
  { name: '张家港保税区灿勤科技有限公司', product: '介质滤波器', region: '江苏省', city: '苏州市', industry: '半导体与集成电路', track: '微波器件', keywords: ['介质滤波器', '5G 射频', '天线'], batch: 1 },
  { name: '苏州绿的谐波传动科技股份有限公司', product: '精密谐波减速器', region: '江苏省', city: '苏州市', industry: '高端装备制造', track: '机器人核心部件', keywords: ['谐波减速器', '柔轮', '精密传动'], batch: 1 },
  { name: '江苏联瑞新材料股份有限公司', product: '电子级二氧化硅微粉', region: '江苏省', city: '连云港市', industry: '新材料', track: '电子粉体', keywords: ['球形硅微粉', '覆铜板', '封装材料'], batch: 1 },
  { name: '迈得医疗工业设备股份有限公司', product: '医用耗材智能装备', region: '浙江省', city: '台州市', industry: '高端装备制造', track: '医疗智能制造', keywords: ['自动化装配', '视觉检测', '医用耗材'], batch: 1 },
  { name: '浙江天际互感器有限公司', product: '互感器', region: '浙江省', city: '嘉兴市', industry: '智能电网', track: '电力测量', keywords: ['电流互感器', '精密绕制', '计量'], batch: 1 },
  { name: '恒锋工具股份有限公司', product: '拉削刀具、花键环塞规', region: '浙江省', city: '嘉兴市', industry: '高端装备制造', track: '精密刀具', keywords: ['拉刀', '精密量规', '刀具涂层'], batch: 1 },
  { name: '浙江华业塑料机械有限公司', product: '塑机螺杆', region: '浙江省', city: '舟山市', industry: '高端装备制造', track: '塑机关键件', keywords: ['螺杆机筒', '表面硬化', '注塑'], batch: 1 },
  { name: '杭州新坐标科技股份有限公司', product: '汽车发动机配气机构', region: '浙江省', city: '杭州市', industry: '汽车及零部件', track: '发动机精锻件', keywords: ['冷镦', '气门组', '精锻'], batch: 1 },
  { name: '杭州华澜微电子股份有限公司', product: '数码存储和信息安全控制器', region: '浙江省', city: '杭州市', industry: '半导体与集成电路', track: '存储主控芯片', keywords: ['SSD 主控', '加密', 'SoC'], batch: 1 },
  { name: '浙江科惠医疗器械股份有限公司', product: '骨科内植入器械', region: '浙江省', city: '衢州市', industry: '生物医药与医疗器械', track: '骨科植入', keywords: ['接骨板', '钛合金', '表面处理'], batch: 1 },
  { name: '浙江丰虹新材料股份有限公司', product: '有机膨润土、无机凝胶', region: '浙江省', city: '湖州市', industry: '新材料', track: '功能性助剂', keywords: ['膨润土', '流变助剂', '改性'], batch: 1 },
  { name: '宁波菲仕电机技术有限公司', product: '节能注塑机用伺服电机', region: '浙江省', city: '宁波市', industry: '高端装备制造', track: '伺服系统', keywords: ['伺服电机', '直驱', '运动控制'], batch: 1 },
  { name: '安徽艾可蓝环保股份有限公司', product: '发动机尾气后处理产品', region: '安徽省', city: '池州市', industry: '节能环保', track: '尾气后处理', keywords: ['SCR', 'DPF', '催化剂'], batch: 1 },
  { name: '安徽捷迅光电技术有限公司', product: '色选机', region: '安徽省', city: '合肥市', industry: '高端装备制造', track: '光电分选', keywords: ['色选', '机器视觉', '农产品分选'], batch: 1 },
  { name: '福建星云电子股份有限公司', product: '锂电池检测系统和自动化组装设备', region: '福建省', city: '宁德市', industry: '新能源与储能', track: '锂电装备', keywords: ['电池检测', '化成分容', '自动化线'], batch: 1 },
  { name: '福建远翔新材料股份有限公司', product: '纳米二氧化硅', region: '福建省', city: '南平市', industry: '新材料', track: '纳米粉体', keywords: ['沉淀二氧化硅', '轮胎填料', '纳米'], batch: 1 },
  { name: '烟台正海生物科技股份有限公司', product: '口腔修复膜与生物膜', region: '山东省', city: '烟台市', industry: '生物医药与医疗器械', track: '再生医学材料', keywords: ['生物膜', '胶原', '组织修复'], batch: 1 },
  { name: '山东开泰抛丸机械股份有限公司', product: '抛丸清理装备', region: '山东省', city: '淄博市', industry: '高端装备制造', track: '表面工程装备', keywords: ['抛丸', '钢板预处理', '耐磨件'], batch: 1 },
  { name: '威海克莱特菲尔风机股份有限公司', product: '轨道交通通风机', region: '山东省', city: '威海市', industry: '高端装备制造', track: '通风设备', keywords: ['轴流风机', '轨交散热', '低噪'], batch: 1 },
  { name: '青岛宝佳自动化设备有限公司', product: '工业机器人智能集成系统', region: '山东省', city: '青岛市', industry: '高端装备制造', track: '机器人集成', keywords: ['码垛机器人', '智能工厂', '系统集成'], batch: 1 },
  { name: '武大吉奥信息技术有限公司', product: 'GeoStar 系列软件平台', region: '湖北省', city: '武汉市', industry: '软件与信息技术', track: '地理信息系统', keywords: ['GIS 平台', '时空数据', '遥感'], batch: 1 },
  { name: '宜昌南玻光电玻璃有限公司', product: '超薄电子玻璃', region: '湖北省', city: '宜昌市', industry: '新材料', track: '电子玻璃', keywords: ['超薄基板', '溢流下拉', '显示材料'], batch: 1 },
  { name: '湖北泰晶电子科技股份有限公司', product: '压电石英晶体元器件', region: '湖北省', city: '随州市', industry: '半导体与集成电路', track: '频率器件', keywords: ['晶振', 'MEMS', '小型化'], batch: 1 },
  { name: '湖南金博碳素股份有限公司', product: '碳/碳复合材料热场部件', region: '湖南省', city: '益阳市', industry: '新材料', track: '碳基材料', keywords: ['碳碳复合', '单晶炉热场', '增密'], batch: 1 },
  { name: '湖南华纳大药厂股份有限公司', product: '果胶铋原料及制剂', region: '湖南省', city: '长沙市', industry: '生物医药与医疗器械', track: '特色原料药', keywords: ['铋制剂', '原料药', 'GMP'], batch: 1 },
  { name: '株洲飞鹿高新材料技术股份有限公司', product: '轨道交通装备防腐及防水涂料', region: '湖南省', city: '株洲市', industry: '新材料', track: '特种涂料', keywords: ['防腐涂料', '减振降噪', '轨交'], batch: 1 },
  { name: '湖南凯美特气体股份有限公司', product: '食品添加剂液体二氧化碳', region: '湖南省', city: '岳阳市', industry: '化工', track: '工业气体', keywords: ['食品级 CO2', '尾气回收', '液态气体'], batch: 1 },
  { name: '广州方邦电子股份有限公司', product: '电磁屏蔽膜', region: '广东省', city: '广州市', industry: '新材料', track: '电子功能膜', keywords: ['屏蔽膜', '蒸镀', '柔性电路'], batch: 1 },
  { name: '广州禾信仪器股份有限公司', product: 'PM2.5 在线源解析质谱监测系统', region: '广东省', city: '广州市', industry: '高端装备制造', track: '质谱仪器', keywords: ['飞行时间质谱', '大气监测', '在线分析'], batch: 1 },
  { name: '广东先导先进材料股份有限公司', product: '半导体材料', region: '广东省', city: '肇庆市', industry: '半导体与集成电路', track: '稀有金属电子材料', keywords: ['镓铟锗', '高纯金属', '外延材料'], batch: 1 },
  { name: '深圳安培龙科技股份有限公司', product: '智能传感器', region: '深圳市', city: '深圳市', industry: '半导体与集成电路', track: '传感器', keywords: ['NTC 热敏', '压力传感器', '车规'], batch: 1 },
  { name: '深圳市雄帝科技股份有限公司', product: '身份识别与智慧交通智能化产品', region: '深圳市', city: '深圳市', industry: '软件与信息技术', track: '数字身份', keywords: ['电子证照', '制卡', '生物识别'], batch: 1 },
  { name: '深圳科安达电子科技股份有限公司', product: '城市轨道交通信号控制系统', region: '深圳市', city: '深圳市', industry: '智能电网', track: '轨道交通信号', keywords: ['计轴', '联锁', '信号安全'], batch: 1 },
  { name: '深圳市容大感光科技股份有限公司', product: 'PCB 线路板油墨', region: '深圳市', city: '深圳市', industry: '新材料', track: '电子油墨', keywords: ['感光油墨', '阻焊', '线路板'], batch: 1 },
  { name: '旭宇光电（深圳）股份有限公司', product: '半导体电光源', region: '深圳市', city: '深圳市', industry: '光学光电子', track: 'LED 器件', keywords: ['LED 封装', '荧光粉', '光效'], batch: 1 },
  { name: '重庆瑜欣平瑞电子股份有限公司', product: '通机点火器、变流器', region: '重庆市', city: '重庆市', industry: '汽车及零部件', track: '通用机械电子', keywords: ['点火器', '变流器', '磁电'], batch: 1 },
  { name: '神驰机电股份有限公司', product: '小型汽油发电机', region: '重庆市', city: '重庆市', industry: '高端装备制造', track: '小型发电设备', keywords: ['变频发电机', '静音', '出口整机'], batch: 1 },
  { name: '四川新易盛通信技术有限公司', product: 'SFP、SFP+、XFP、QSFP 系列光模块', region: '四川省', city: '成都市', industry: '光学光电子', track: '光模块', keywords: ['高速光模块', '光器件', '数据中心互连'], batch: 1 },
  { name: '四川日机密封件股份有限公司', product: '干气密封', region: '四川省', city: '成都市', industry: '高端装备制造', track: '关键基础件', keywords: ['干气密封', '压缩机组', '动静环'], batch: 1 },
  { name: '成都四方伟业软件股份有限公司', product: '大数据平台', region: '四川省', city: '成都市', industry: '软件与信息技术', track: '大数据与治理', keywords: ['数据治理', '可视化分析', '知识图谱'], batch: 1 },
  { name: '贵州航宇科技发展股份有限公司', product: '航空航天发动机用环锻件', region: '贵州省', city: '贵阳市', industry: '航空航天与军工', track: '环形锻件', keywords: ['辗环', '高温合金', '航空结构件'], batch: 1 },
  { name: '云南震安减震科技股份有限公司', product: '隔震减震装置', region: '云南省', city: '昆明市', industry: '高端装备制造', track: '建筑减隔震', keywords: ['隔震支座', '阻尼器', '抗震'], batch: 1 },
  { name: '云南北方奥雷德光电科技股份有限公司', product: 'OLED 微型显示器', region: '云南省', city: '昆明市', industry: '光学光电子', track: '微显示', keywords: ['OLED 微显', '硅基', '近眼显示'], batch: 1 },
  { name: '陕西中天火箭技术股份有限公司', product: '增雨防雹产品', region: '陕西省', city: '西安市', industry: '航空航天与军工', track: '人工影响天气', keywords: ['火箭发射', '催化剂播撒', '测控'], batch: 1 },
  { name: '西安特锐德智能充电科技有限公司', product: '直流电源模块', region: '陕西省', city: '西安市', industry: '新能源与储能', track: '充电模块', keywords: ['直流充电桩', '功率模块', '大功率'], batch: 1 },
  { name: '兰州西脉记忆合金股份有限公司', product: '固定植入器械、心脏瓣膜', region: '甘肃省', city: '兰州市', industry: '生物医药与医疗器械', track: '植入器械', keywords: ['记忆合金', '骨科内固定', '瓣膜'], batch: 1 },
];

/** 名单抓取来源，写入 tvd_data_sources / tvd_source_records。 */
export const DEMO_ENTERPRISE_SOURCES = [
  {
    code: 'miit_sjmr_batch1',
    name: '工业和信息化部 第一批专精特新"小巨人"企业名单（2019，248 家）',
    url: 'https://www.miit.gov.cn/',
    /** 实际读到全文表格的地址（名单原文的第三方转载，用于取回企业名与主导产品列）。 */
    retrievalUrl: 'https://www.maigoo.com/news/521257.html',
    retrievedAt: '2026-11-22',
    note:
      '官方名单原文以附件形式发布；本次逐条核对用的是转载全文表格，' +
      '因此来源独立性记为 single_source，unified_code 一律不填。',
  },
] as const;

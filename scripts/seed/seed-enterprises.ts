import { randomUUID } from 'node:crypto';
import type { SeedResult } from './seed-all';

type EnterpriseProfile = {
  industry_stage: string;
  business_status: string;
  tech_attributes: string;
  product_competitiveness: string;
  growth_potential: string;
  market_space: string;
  financing_status: string;
  enterprise_dynamics: string;
  risk_alerts: string;
  supply_chain_position: string;
  competitors: string;
};

type EnterpriseRow = {
  id: string;
  tenant_id: string;
  name: string;
  unified_code: string;
  industry: string;
  scale: string;
  region: string;
  level: string;
  risk_level: string;
  profile: EnterpriseProfile;
  tags: string[];
  is_tech: boolean;
};

const ENTERPRISES: EnterpriseRow[] = [
  {
    id: randomUUID(),
    tenant_id: '',
    name: '华为技术有限公司',
    unified_code: '待录入',
    industry: '通信设备/半导体',
    scale: '超大型',
    region: '华南',
    level: '龙头',
    risk_level: 'medium',
    is_tech: true,
    tags: ['高新技术企业', '5G', '芯片', '操作系统'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约7000亿，利润率约8%，员工约20万',
      tech_attributes: '5G/芯片/操作系统，专利超12万件，研发投入占比约25%',
      product_competitiveness: '智能手机/通信设备/云计算，差异化：全栈自研芯片+鸿蒙OS',
      growth_potential: '成熟期，汽车/云计算新增长极',
      market_space: '全球通信设备市场约5000亿',
      financing_status: '未上市，员工持股',
      enterprise_dynamics: 'Mate60发布、汽车业务推进、鸿蒙生态扩展',
      risk_alerts: '制裁风险、供应链受限',
      supply_chain_position: '上游芯片自研，下游运营商/消费者',
      competitors: '苹果/三星/爱立信',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '腾讯控股有限公司',
    unified_code: '待录入',
    industry: '互联网/云计算',
    scale: '超大型',
    region: '华南',
    level: '龙头',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '云计算', '社交', '游戏'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约5600亿，利润率约25%，员工约10万',
      tech_attributes: '社交/游戏/云计算，专利超6万件，研发投入占比约10%',
      product_competitiveness: '微信/QQ/腾讯云，差异化：超级社交平台+游戏生态',
      growth_potential: '成熟期，产业互联网/视频号新增长极',
      market_space: '中国互联网市场约万亿',
      financing_status: '港股上市，市值约3万亿',
      enterprise_dynamics: '视频号商业化加速、腾讯云出海',
      risk_alerts: '游戏监管风险、反垄断关注',
      supply_chain_position: '上游云基础设施自建，下游C端/B端用户',
      competitors: '阿里/字节跳动/网易',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '阿里巴巴集团',
    unified_code: '待录入',
    industry: '电子商务/云计算',
    scale: '超大型',
    region: '华东',
    level: '龙头',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '云计算', '电子商务', 'AI'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约8600亿，利润率约8%，员工约20万',
      tech_attributes: '电商/云计算/AI，专利超3万件，研发投入占比约15%',
      product_competitiveness: '淘宝/天猫/阿里云，差异化：电商+云双轮驱动',
      growth_potential: '成熟期，AI/国际化新增长极',
      market_space: '中国电商市场约10万亿',
      financing_status: '美股/港股上市，市值约1.5万亿',
      enterprise_dynamics: '阿里云降价扩张、AI大模型通义系列发布',
      risk_alerts: '反垄断监管、电商竞争加剧',
      supply_chain_position: '上游云基础设施自建，下游商家/消费者',
      competitors: '京东/拼多多/腾讯',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '字节跳动',
    unified_code: '待录入',
    industry: '互联网/AI',
    scale: '超大型',
    region: '华北',
    level: '龙头',
    risk_level: 'medium',
    is_tech: true,
    tags: ['高新技术企业', 'AI', '短视频', '信息分发'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约8000亿，利润率约20%，员工约15万',
      tech_attributes: '推荐算法/AI/短视频，专利超2万件，研发投入占比约12%',
      product_competitiveness: '抖音/今日头条/TikTok，差异化：算法驱动内容分发',
      growth_potential: '成长期，AI/教育/电商新增长极',
      market_space: '全球短视频市场约3000亿',
      financing_status: '未上市，估值约2万亿',
      enterprise_dynamics: 'TikTok全球扩张、豆包AI大模型发布',
      risk_alerts: '地缘政治风险、数据安全合规',
      supply_chain_position: '上游AI技术自研，下游C端全球用户',
      competitors: '腾讯/快手/Google',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '百度公司',
    unified_code: '待录入',
    industry: '人工智能/搜索',
    scale: '大型',
    region: '华北',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', 'AI', '搜索', '自动驾驶'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约1300亿，利润率约15%，员工约4万',
      tech_attributes: 'AI/搜索/自动驾驶，专利超3万件，研发投入占比约20%',
      product_competitiveness: '百度搜索/文心一言/Apollo，差异化：AI全栈能力+自动驾驶',
      growth_potential: '成熟期，AI大模型/自动驾驶新增长极',
      market_space: '中国搜索市场约500亿',
      financing_status: '美股/港股上市，市值约3000亿',
      enterprise_dynamics: '文心一言大模型发布、Apollo商业化推进',
      risk_alerts: '搜索市场份额下滑、AI商业化不确定',
      supply_chain_position: '上游AI技术自研，下游C端/B端用户',
      competitors: '谷歌/腾讯/字节跳动',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '京东集团',
    unified_code: '待录入',
    industry: '电子商务/物流',
    scale: '超大型',
    region: '华北',
    level: '龙头',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '电子商务', '物流', '供应链'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约1万亿，利润率约3%，员工约50万',
      tech_attributes: '物流/电商/供应链，专利超1万件，研发投入占比约5%',
      product_competitiveness: '京东商城/京东物流，差异化：自营物流+品质电商',
      growth_potential: '成熟期，物流开放/下沉市场新增长极',
      market_space: '中国电商市场约10万亿',
      financing_status: '美股/港股上市，市值约4000亿',
      enterprise_dynamics: '京东物流上市、百亿补贴竞争',
      risk_alerts: '电商价格战、物流成本上升',
      supply_chain_position: '上游品牌商直采，下游消费者',
      competitors: '阿里/拼多多/美团',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '美团',
    unified_code: '待录入',
    industry: '本地生活/互联网',
    scale: '大型',
    region: '华北',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '本地生活', '外卖', '即时配送'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约2700亿，利润率约5%，员工约10万',
      tech_attributes: '即时配送/本地生活，专利超1万件，研发投入占比约8%',
      product_competitiveness: '美团外卖/美团优选，差异化：本地生活超级平台',
      growth_potential: '成长期，社区团购/即时零售新增长极',
      market_space: '中国本地生活市场约2万亿',
      financing_status: '港股上市，市值约5000亿',
      enterprise_dynamics: '社区团购扩张、即时零售推进',
      risk_alerts: '骑手权益监管、竞争加剧',
      supply_chain_position: '上游商家/骑手网络，下游消费者',
      competitors: '阿里/字节跳动/拼多多',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '大疆创新',
    unified_code: '待录入',
    industry: '无人机/机器人',
    scale: '中型',
    region: '华南',
    level: '领先',
    risk_level: 'medium',
    is_tech: true,
    tags: ['高新技术企业', '无人机', '机器人', '飞控技术'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约300亿，利润率约20%，员工约1.5万',
      tech_attributes: '飞控/影像/无人机，专利超8000件，研发投入占比约15%',
      product_competitiveness: '消费级/行业级无人机，差异化：全球无人机龙头',
      growth_potential: '成长期，行业应用/机器人新增长极',
      market_space: '全球无人机市场约500亿',
      financing_status: '未上市，估值约1500亿',
      enterprise_dynamics: '行业无人机拓展、车载业务探索',
      risk_alerts: '制裁风险、消费市场饱和',
      supply_chain_position: '上游芯片/传感器采购，下游消费者/行业客户',
      competitors: 'Intel/Parrot/零度智控',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '商汤科技',
    unified_code: '待录入',
    industry: '人工智能/计算机视觉',
    scale: '中型',
    region: '华东',
    level: '重要',
    risk_level: 'high',
    is_tech: true,
    tags: ['高新技术企业', 'AI', '计算机视觉', '大模型'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约40亿，利润率负，员工约5000',
      tech_attributes: '计算机视觉/大模型，专利超1万件，研发投入占比约60%',
      product_competitiveness: 'SenseCore/日日新大模型，差异化：AI基础设施+行业方案',
      growth_potential: '成长期，大模型/智慧城市新增长极',
      market_space: '中国AI市场约2000亿',
      financing_status: '港股上市，市值约500亿',
      enterprise_dynamics: '日日新大模型发布、智慧城市项目拓展',
      risk_alerts: '制裁风险、盈利压力',
      supply_chain_position: '上游算力采购，下游政府/企业客户',
      competitors: '旷视/科大讯飞/百度',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '旷视科技',
    unified_code: '待录入',
    industry: '人工智能/计算机视觉',
    scale: '中型',
    region: '华北',
    level: '重要',
    risk_level: 'high',
    is_tech: true,
    tags: ['高新技术企业', 'AI', '计算机视觉', '物联网'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约20亿，利润率负，员工约3000',
      tech_attributes: '计算机视觉/物联网，专利超3000件，研发投入占比约50%',
      product_competitiveness: 'Face++/河图，差异化：算法+软硬件一体化',
      growth_potential: '成长期，供应链物流/消费物联网新增长极',
      market_space: '中国AI市场约2000亿',
      financing_status: '未上市，估值约300亿',
      enterprise_dynamics: '供应链物联网拓展、AIoT产品线推进',
      risk_alerts: '制裁风险、IPO受阻、盈利压力',
      supply_chain_position: '上游算力/传感器采购，下游企业客户',
      competitors: '商汤/科大讯飞/百度',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '科大讯飞',
    unified_code: '待录入',
    industry: '人工智能/语音技术',
    scale: '中型',
    region: '华东',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', 'AI', '语音技术', '教育'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约200亿，利润率约5%，员工约1.5万',
      tech_attributes: '语音识别/自然语言处理，专利超2万件，研发投入占比约20%',
      product_competitiveness: '讯飞输入法/星火大模型，差异化：语音AI龙头+教育深耕',
      growth_potential: '成长期，大模型/医疗AI新增长极',
      market_space: '中国语音AI市场约300亿',
      financing_status: 'A股上市，市值约1000亿',
      enterprise_dynamics: '星火大模型发布、教育业务全国推广',
      risk_alerts: 'AI竞争加剧、教育政策变化',
      supply_chain_position: '上游算力采购，下游政府/学校/消费者',
      competitors: '百度/腾讯/商汤',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '中芯国际',
    unified_code: '待录入',
    industry: '半导体/芯片制造',
    scale: '大型',
    region: '华东',
    level: '龙头',
    risk_level: 'high',
    is_tech: true,
    tags: ['高新技术企业', '半导体', '芯片制造', '晶圆代工'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约500亿，利润率约10%，员工约2万',
      tech_attributes: '晶圆代工/芯片制造，专利超1万件，研发投入占比约20%',
      product_competitiveness: '14nm/28nm晶圆代工，差异化：国内最大晶圆代工厂',
      growth_potential: '成长期，国产替代/先进制程新增长极',
      market_space: '全球晶圆代工市场约5000亿',
      financing_status: 'A股/港股上市，市值约3000亿',
      enterprise_dynamics: '扩产28nm/14nm、先进制程研发推进',
      risk_alerts: '制裁风险、设备进口受限、先进制程瓶颈',
      supply_chain_position: '上游设备/材料采购，下游芯片设计公司',
      competitors: '台积电/三星/联电',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '宁德时代',
    unified_code: '待录入',
    industry: '新能源/电池',
    scale: '大型',
    region: '华东',
    level: '龙头',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '新能源', '动力电池', '储能'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约3000亿，利润率约10%，员工约10万',
      tech_attributes: '动力电池/储能，专利超2万件，研发投入占比约8%',
      product_competitiveness: '麒麟电池/钠离子电池，差异化：全球动力电池龙头',
      growth_potential: '成长期，储能/新材料新增长极',
      market_space: '全球动力电池市场约3000亿',
      financing_status: 'A股上市，市值约8000亿',
      enterprise_dynamics: '麒麟电池量产、储能业务高速增长',
      risk_alerts: '原材料价格波动、海外竞争加剧',
      supply_chain_position: '上游锂/钴/镍采购，下游车企',
      competitors: '比亚迪/LG新能源/松下',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '比亚迪',
    unified_code: '待录入',
    industry: '新能源汽车/电池',
    scale: '超大型',
    region: '华南',
    level: '龙头',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '新能源汽车', '电池', '混动技术'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约6000亿，利润率约5%，员工约70万',
      tech_attributes: '刀片电池/DM-i混动，专利超2万件，研发投入占比约6%',
      product_competitiveness: '秦/汉/宋/海豹系列，差异化：垂直整合+刀片电池',
      growth_potential: '成长期，海外市场/高端品牌新增长极',
      market_space: '中国新能源汽车市场约5000亿',
      financing_status: 'A股/港股上市，市值约7000亿',
      enterprise_dynamics: '年销超300万辆、海外市场加速拓展',
      risk_alerts: '价格竞争激烈、补贴退坡',
      supply_chain_position: '上游电池/芯片自研自产，下游消费者',
      competitors: '特斯拉/蔚来/理想/小鹏',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '蔚来汽车',
    unified_code: '待录入',
    industry: '新能源汽车',
    scale: '中型',
    region: '华东',
    level: '重要',
    risk_level: 'medium',
    is_tech: true,
    tags: ['高新技术企业', '新能源汽车', '换电', '智能驾驶'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约500亿，利润率负，员工约3万',
      tech_attributes: '换电/智能驾驶，专利超5000件，研发投入占比约30%',
      product_competitiveness: 'ES8/ET7/ET5，差异化：换电模式+高端定位',
      growth_potential: '成长期，换电网络/子品牌新增长极',
      market_space: '中国新能源汽车市场约5000亿',
      financing_status: '美股/港股上市，市值约1000亿',
      enterprise_dynamics: '换电网络扩张、子品牌乐道发布',
      risk_alerts: '盈利压力、竞争加剧',
      supply_chain_position: '上游电池/芯片采购，下游消费者',
      competitors: '特斯拉/理想/小鹏/比亚迪',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '理想汽车',
    unified_code: '待录入',
    industry: '新能源汽车',
    scale: '中型',
    region: '华北',
    level: '重要',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '新能源汽车', '增程混动', '智能驾驶'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约1200亿，利润率约5%，员工约2万',
      tech_attributes: '增程混动/智能驾驶，专利超3000件，研发投入占比约15%',
      product_competitiveness: 'L9/L8/L7/Mega，差异化：增程技术+家庭定位',
      growth_potential: '成长期，纯电车型/智驾新增长极',
      market_space: '中国新能源汽车市场约5000亿',
      financing_status: '美股/港股上市，市值约2000亿',
      enterprise_dynamics: 'Mega发布、纯电产品线规划',
      risk_alerts: '纯电转型风险、竞争加剧',
      supply_chain_position: '上游电池/芯片采购，下游消费者',
      competitors: '蔚来/小鹏/比亚迪/特斯拉',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '小鹏汽车',
    unified_code: '待录入',
    industry: '新能源汽车',
    scale: '中型',
    region: '华南',
    level: '重要',
    risk_level: 'medium',
    is_tech: true,
    tags: ['高新技术企业', '新能源汽车', '智能驾驶', '飞行汽车'],
    profile: {
      industry_stage: '成长期',
      business_status: '营收约300亿，利润率负，员工约1.5万',
      tech_attributes: '智能驾驶/800V平台，专利超3000件，研发投入占比约25%',
      product_competitiveness: 'G6/G9/P7i，差异化：智驾技术领先+800V快充',
      growth_potential: '成长期，智驾/国际化新增长极',
      market_space: '中国新能源汽车市场约5000亿',
      financing_status: '美股上市，市值约500亿',
      enterprise_dynamics: 'XNGP智驾全国推送、欧洲市场拓展',
      risk_alerts: '盈利压力、销量波动',
      supply_chain_position: '上游电池/芯片采购，下游消费者',
      competitors: '蔚来/理想/比亚迪/特斯拉',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: '小米集团',
    unified_code: '待录入',
    industry: '消费电子/智能手机',
    scale: '大型',
    region: '华北',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '智能手机', 'IoT', '新能源汽车'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约2700亿，利润率约5%，员工约3万',
      tech_attributes: '智能手机/IoT/汽车，专利超3万件，研发投入占比约6%',
      product_competitiveness: '小米手机/米家/小米汽车，差异化：IoT生态+性价比',
      growth_potential: '成熟期，汽车/IoT新增长极',
      market_space: '全球智能手机市场约3000亿',
      financing_status: '港股上市，市值约3000亿',
      enterprise_dynamics: '小米SU7发布、IoT生态持续扩张',
      risk_alerts: '汽车业务投入大、手机竞争激烈',
      supply_chain_position: '上游芯片/屏幕采购，下游消费者',
      competitors: '苹果/华为/OPPO/vivo',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: 'OPPO',
    unified_code: '待录入',
    industry: '消费电子/智能手机',
    scale: '大型',
    region: '华南',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '智能手机', '影像技术', '快充'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约1500亿，利润率约8%，员工约4万',
      tech_attributes: '影像/快充/智能手机，专利超4万件，研发投入占比约8%',
      product_competitiveness: 'Find/Reno系列，差异化：影像技术+快充领先',
      growth_potential: '成熟期，IoT/海外市场新增长极',
      market_space: '全球智能手机市场约3000亿',
      financing_status: '未上市，估值约1500亿',
      enterprise_dynamics: 'Find N折叠屏系列、海外市场扩张',
      risk_alerts: '手机市场饱和、芯片供应风险',
      supply_chain_position: '上游芯片/屏幕采购，下游消费者',
      competitors: '小米/华为/vivo/苹果',
    },
  },
  {
    id: randomUUID(),
    tenant_id: '',
    name: 'vivo',
    unified_code: '待录入',
    industry: '消费电子/智能手机',
    scale: '大型',
    region: '华南',
    level: '领先',
    risk_level: 'low',
    is_tech: true,
    tags: ['高新技术企业', '智能手机', '影像技术', 'Hi-Fi'],
    profile: {
      industry_stage: '成熟期',
      business_status: '营收约1500亿，利润率约8%，员工约4万',
      tech_attributes: '影像/Hi-Fi/智能手机，专利超3万件，研发投入占比约8%',
      product_competitiveness: 'X/S/iQOO系列，差异化：影像+Hi-Fi音质',
      growth_potential: '成熟期，IoT/海外市场新增长极',
      market_space: '全球智能手机市场约3000亿',
      financing_status: '未上市，估值约1500亿',
      enterprise_dynamics: 'X100影像旗舰、海外市场扩张',
      risk_alerts: '手机市场饱和、芯片供应风险',
      supply_chain_position: '上游芯片/屏幕采购，下游消费者',
      competitors: '小米/华为/OPPO/苹果',
    },
  },
];

export async function seedEnterprises(tenantId: string): Promise<SeedResult> {
  console.log(`[Seed] enterprises: tenant=${tenantId}`);
  const failures: Array<{ rowIndex: number; reason: string }> = [];
  let successCount = 0;

  let supabase;
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    supabase = getSupabaseClient();
  } catch (err) {
    console.warn('[Seed] enterprises: Supabase client unavailable (DEMO_MODE), skipping actual writes');
    console.log('[Seed] enterprises: Data prepared — 20 enterprises with full 12-dimension profiles');
    return {
      module: 'enterprises',
      successCount: 0,
      failureCount: ENTERPRISES.length,
      failures: ENTERPRISES.map((_, i) => ({ rowIndex: i, reason: 'DEMO_MODE: database not connected' })),
    };
  }

  for (let i = 0; i < ENTERPRISES.length; i++) {
    const ent = ENTERPRISES[i];
    const row = { ...ent, tenant_id: tenantId };

    try {
      const { data: existing } = await supabase
        .from('enterprise')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', ent.name)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('enterprise')
          .update({
            unified_code: row.unified_code,
            industry: row.industry,
            scale: row.scale,
            region: row.region,
            level: row.level,
            risk_level: row.risk_level,
            profile: row.profile,
            tags: row.tags,
            is_tech: row.is_tech,
          })
          .eq('id', existing.id);
        if (error) {
          failures.push({ rowIndex: i, reason: `Update failed: ${error.message}` });
        } else {
          successCount++;
        }
      } else {
        const { error } = await supabase.from('enterprise').insert(row);
        if (error) {
          failures.push({ rowIndex: i, reason: `Insert failed: ${error.message}` });
        } else {
          successCount++;
        }
      }
    } catch (err) {
      failures.push({ rowIndex: i, reason: String(err) });
    }
  }

  return { module: 'enterprises', successCount, failureCount: failures.length, failures };
}
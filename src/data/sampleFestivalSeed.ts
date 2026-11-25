import { AttachmentCategory, ColorKey, NoteType, StageTone, TeamRef } from '../types';
import { addDays, getTodayStr } from '../utils/dateUtils';

export interface SeedBureau {
  id: string;
  name: string;
  shortName: string;
  colorKey: ColorKey;
  order: number;
  teams: { id: string; name: string }[];
}

export interface SeedInitiative {
  id: string;
  name: string;
  description: string;
  colorKey: ColorKey;
  teamRefs: TeamRef[];
  startDate: string;
  endDate: string;
  stageId: string;
  progressPercent: number;
  isMilestone: boolean;
  isVerified: boolean;
  verifiedBy: string;
  notes: {
    id: string;
    noteType: NoteType;
    content: string;
    authorName: string;
    authorBureau: string;
  }[];
}

export interface SeedTask {
  id: string;
  title: string;
  description: string;
  bureauId: string;
  teamId: string;
  assigneeName: string;
  initiativeId: string;
  stageId: string;
  progressPercent: number;
  startDate: string;
  endDate: string;
  isMilestone: boolean;
  isVerified: boolean;
  verifiedBy: string;
  notes: {
    id: string;
    noteType: NoteType;
    content: string;
    authorName: string;
    authorBureau: string;
  }[];
  attachments: {
    id: string;
    title: string;
    category: AttachmentCategory;
    url: string;
    uploadedBy: string;
  }[];
}

export interface SeedStage {
  id: string;
  name: string;
  order: number;
  defaultPercent: number;
  tone: StageTone;
}

export function buildSampleFestivalSeed() {
  const today = getTodayStr();
  const festivalStart = addDays(today, 18);
  const festivalEnd = addDays(today, 19);

  const bureaus: SeedBureau[] = [
    {
      id: 'bureau_soumu',
      name: '総務局',
      shortName: '総務',
      colorKey: 'indigo',
      order: 1,
      teams: [
        { id: 'team_soumu_shinsei', name: '学内申請・許認可担当' },
        { id: 'team_soumu_keibi', name: '警備・動線管理担当' },
        { id: 'team_soumu_bihin', name: '備品・会場設営担当' },
      ],
    },
    {
      id: 'bureau_kikaku',
      name: '企画局',
      shortName: '企画',
      colorKey: 'teal',
      order: 2,
      teams: [
        { id: 'team_kikaku_honbu', name: '本部企画担当' },
        { id: 'team_kikaku_kyoshitsu', name: '教室企画審査担当' },
        { id: 'team_kikaku_guest', name: 'ゲスト講演担当' },
      ],
    },
    {
      id: 'bureau_stage',
      name: 'ステージ局',
      shortName: 'ステージ',
      colorKey: 'amber',
      order: 3,
      teams: [
        { id: 'team_stage_pa', name: '音響・照明技術担当' },
        { id: 'team_stage_shinko', name: '出演団体進行担当' },
      ],
    },
    {
      id: 'bureau_koho',
      name: '広報局',
      shortName: '広報',
      colorKey: 'violet',
      order: 4,
      teams: [
        { id: 'team_koho_print', name: 'Web・パンフレット制作担当' },
        { id: 'team_koho_sns', name: 'SNS・学外広報担当' },
      ],
    },
    {
      id: 'bureau_mogiten',
      name: '模擬店・財務局',
      shortName: '模擬・財務',
      colorKey: 'emerald',
      order: 5,
      teams: [
        { id: 'team_mogi_eisei', name: '模擬店衛生・保健所担当' },
        { id: 'team_mogi_zaimu', name: '予算・協賛金管理担当' },
        { id: 'team_mogi_eco', name: 'ゴミ・環境対策担当' },
      ],
    },
  ];

  const stages: SeedStage[] = [
    { id: 'stage_1_not_started', name: '未着手', order: 1, defaultPercent: 0, tone: 'neutral' },
    { id: 'stage_2_planning', name: '企画・下準備', order: 2, defaultPercent: 20, tone: 'info' },
    { id: 'stage_3_working', name: '作業・制作中', order: 3, defaultPercent: 45, tone: 'progress' },
    { id: 'stage_4_bureau_check', name: '局内確認中', order: 4, defaultPercent: 70, tone: 'review' },
    { id: 'stage_5_final_wait', name: '総務・最終承認待ち', order: 5, defaultPercent: 90, tone: 'approval' },
    { id: 'stage_6_done', name: '完了', order: 6, defaultPercent: 100, tone: 'done' },
  ];

  const initiatives: SeedInitiative[] = [
    {
      id: 'init_campus_permit',
      name: '大学施設使用・電力容量申請',
      description: '学生課・施設管理課へのキャンパス使用許可、屋外ステージ電源15kVA枠の申請と受理確認。',
      colorKey: 'indigo',
      teamRefs: [
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_shinsei' },
        { bureauId: 'bureau_stage', teamId: 'team_stage_pa' },
      ],
      startDate: addDays(today, -16),
      endDate: addDays(today, -5),
      stageId: 'stage_6_done',
      progressPercent: 100,
      isMilestone: true,
      isVerified: true,
      verifiedBy: '委員長 佐藤',
      notes: [
        {
          id: 'inote_01',
          noteType: 'approval_memo',
          content: '学生課窓口にて受領印確認済み。電力容量枠・テント設営エリアともに正式許可取得完了。',
          authorName: '高橋 健太',
          authorBureau: '総務局',
        },
      ],
    },
    {
      id: 'init_publicity_print',
      name: '公式パンフレット・特設Webサイト制作',
      description: '全企画マップ、タイムテーブル、模擬店一覧、協賛広告ページの校正・入稿および特設Web公開。',
      colorKey: 'violet',
      teamRefs: [
        { bureauId: 'bureau_koho', teamId: 'team_koho_print' },
        { bureauId: 'bureau_koho', teamId: 'team_koho_sns' },
        { bureauId: 'bureau_kikaku', teamId: 'team_kikaku_kyoshitsu' },
      ],
      startDate: addDays(today, -12),
      endDate: addDays(today, 2),
      stageId: 'stage_5_final_wait',
      progressPercent: 90,
      isMilestone: true,
      isVerified: true,
      verifiedBy: '広報局長 田中',
      notes: [],
    },
    {
      id: 'init_guest_lecture',
      name: '特別ゲスト講演会・本部抽選企画',
      description: '特別ゲスト講演の台本・控室手配・警備動線と本部スタンプラリー企画の合同推進。',
      colorKey: 'teal',
      teamRefs: [
        { bureauId: 'bureau_kikaku', teamId: 'team_kikaku_guest' },
        { bureauId: 'bureau_kikaku', teamId: 'team_kikaku_honbu' },
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_keibi' },
      ],
      startDate: addDays(today, -8),
      endDate: addDays(today, 8),
      stageId: 'stage_4_bureau_check',
      progressPercent: 70,
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [
        {
          id: 'inote_04',
          noteType: 'change_log',
          content: 'ゲスト控室を3号館302号室から本館特別会議室へ変更。総務局にて鍵・案内導線確認済み。',
          authorName: '渡辺 陸',
          authorBureau: '企画局',
        },
      ],
    },
    {
      id: 'init_main_stage',
      name: 'メインステージ音響PA・出演進行',
      description: '屋外特設ステージのPA・照明業者手配、出演14団体の転換タイムテーブル・リハ枠管理。',
      colorKey: 'amber',
      teamRefs: [
        { bureauId: 'bureau_stage', teamId: 'team_stage_pa' },
        { bureauId: 'bureau_stage', teamId: 'team_stage_shinko' },
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_bihin' },
      ],
      startDate: addDays(today, -6),
      endDate: addDays(today, 11),
      stageId: 'stage_3_working',
      progressPercent: 55,
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
    },
    {
      id: 'init_stalls_hygiene',
      name: '模擬店 保健所臨時営業許可・衛生管理',
      description: '模擬店20団体の検便検査・アレルゲン表示確認と保健所への一括申請。',
      colorKey: 'emerald',
      teamRefs: [
        { bureauId: 'bureau_mogiten', teamId: 'team_mogi_eisei' },
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_bihin' },
      ],
      startDate: addDays(today, -14),
      endDate: addDays(today, -2),
      stageId: 'stage_6_done',
      progressPercent: 100,
      isMilestone: false,
      isVerified: true,
      verifiedBy: '財務・衛生統括 木村',
      notes: [],
    },
    {
      id: 'init_festival_days',
      name: '前日全体設営・大学祭本番運営・撤収',
      description: '前日テント・ステージ設営リハーサル、本番2日間の警備・本部運営、終了後原状回復。',
      colorKey: 'indigo',
      teamRefs: [
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_keibi' },
        { bureauId: 'bureau_soumu', teamId: 'team_soumu_bihin' },
        { bureauId: 'bureau_stage', teamId: 'team_stage_shinko' },
        { bureauId: 'bureau_mogiten', teamId: 'team_mogi_eco' },
      ],
      startDate: addDays(today, 17),
      endDate: festivalEnd,
      stageId: 'stage_1_not_started',
      progressPercent: 0,
      isMilestone: true,
      isVerified: false,
      verifiedBy: '',
      notes: [],
    },
  ];

  const tasks: SeedTask[] = [
    {
      id: 'task_campus_permit_doc',
      title: 'キャンパス使用許可願・配置図の大学提出',
      description: 'テント位置・消防導線を含む全体配置図を添付して学生課へ提出。',
      bureauId: 'bureau_soumu',
      teamId: 'team_soumu_shinsei',
      assigneeName: '高橋 健太',
      initiativeId: 'init_campus_permit',
      stageId: 'stage_6_done',
      progressPercent: 100,
      startDate: addDays(today, -16),
      endDate: addDays(today, -7),
      isMilestone: true,
      isVerified: true,
      verifiedBy: '委員長 佐藤',
      notes: [
        {
          id: 'tnote_01',
          noteType: 'approval_memo',
          content: '学生課の受領印を確認済み。原本は実行委本部キャビネットに保管。',
          authorName: '高橋 健太',
          authorBureau: '総務局',
        },
      ],
      attachments: [
        {
          id: 'att_01',
          title: '令和7年度 キャンパス全体配置図（提出済）',
          category: 'layout',
          url: 'https://docs.google.com/document/d/example-campus-layout',
          uploadedBy: '高橋 健太',
        },
      ],
    },
    {
      id: 'task_power_capacity',
      title: '屋外ステージ電源系統図・負荷計算書作成',
      description: 'PA・照明の最大消費電力を算出し、施設管理課へ提出。',
      bureauId: 'bureau_stage',
      teamId: 'team_stage_pa',
      assigneeName: '吉田 拓海',
      initiativeId: 'init_campus_permit',
      stageId: 'stage_6_done',
      progressPercent: 100,
      startDate: addDays(today, -14),
      endDate: addDays(today, -5),
      isMilestone: false,
      isVerified: true,
      verifiedBy: '総務局長 鈴木',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_pamphlet_proof',
      title: 'パンフレット最終校正・印刷所入稿',
      description: '全32ページの誤字脱字・企画時間・協賛社ロゴの最終確認と入稿。',
      bureauId: 'bureau_koho',
      teamId: 'team_koho_print',
      assigneeName: '斎藤 真央',
      initiativeId: 'init_publicity_print',
      stageId: 'stage_5_final_wait',
      progressPercent: 90,
      startDate: addDays(today, -12),
      endDate: addDays(today, 2),
      isMilestone: true,
      isVerified: true,
      verifiedBy: '広報局長 田中',
      notes: [
        {
          id: 'tnote_02',
          noteType: 'progress_check',
          content: '色校確認済み。総務局からのマップ最終修正反映後に印刷確定。',
          authorName: '斎藤 真央',
          authorBureau: '広報局',
        },
      ],
      attachments: [
        {
          id: 'att_02',
          title: 'パンフレット校正チェックリスト',
          category: 'plan',
          url: 'https://docs.google.com/spreadsheets/d/example-pamphlet-check',
          uploadedBy: '斎藤 真央',
        },
      ],
    },
    {
      id: 'task_classroom_map_data',
      title: '教室企画一覧・時間割原稿の広報提出',
      description: '32団体の教室番号・展示内容を確定し広報局へ提供。',
      bureauId: 'bureau_kikaku',
      teamId: 'team_kikaku_kyoshitsu',
      assigneeName: '小林 彩花',
      initiativeId: 'init_publicity_print',
      stageId: 'stage_6_done',
      progressPercent: 100,
      startDate: addDays(today, -12),
      endDate: addDays(today, -2),
      isMilestone: false,
      isVerified: true,
      verifiedBy: '広報局長 田中',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_guest_cue_sheet',
      title: 'ゲスト講演会 当日進行台本・控室手配',
      description: '事務所確認用の進行台本（分刻み）と本館特別会議室の備品配置。',
      bureauId: 'bureau_kikaku',
      teamId: 'team_kikaku_guest',
      assigneeName: '渡辺 陸',
      initiativeId: 'init_guest_lecture',
      stageId: 'stage_4_bureau_check',
      progressPercent: 75,
      startDate: addDays(today, -8),
      endDate: addDays(today, 6),
      isMilestone: true,
      isVerified: false,
      verifiedBy: '',
      notes: [
        {
          id: 'tnote_03',
          noteType: 'pending_verify',
          content: 'ゲスト事務所へ第2稿台本を送付中。回答戻り次第、警備担当と導線最終確認。',
          authorName: '渡辺 陸',
          authorBureau: '企画局',
        },
      ],
      attachments: [
        {
          id: 'att_03',
          title: '特別ゲスト講演会 進行台本（第2稿）',
          category: 'plan',
          url: 'https://docs.google.com/document/d/example-guest-script',
          uploadedBy: '渡辺 陸',
        },
      ],
    },
    {
      id: 'task_guest_security_route',
      title: 'ゲスト入退場・待機列 警備人員配置計画',
      description: '開演前後の混雑整理および車両入構ルートの警備シフト作成。',
      bureauId: 'bureau_soumu',
      teamId: 'team_soumu_keibi',
      assigneeName: '中村 隼人',
      initiativeId: 'init_guest_lecture',
      stageId: 'stage_3_working',
      progressPercent: 55,
      startDate: addDays(today, -4),
      endDate: addDays(today, 8),
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_honbu_lottery',
      title: '本部スタンプラリー景品・抽選ルール確定',
      description: '協賛品の数量確認と本部テントでの景品引換マニュアル作成。',
      bureauId: 'bureau_kikaku',
      teamId: 'team_kikaku_honbu',
      assigneeName: '松本 優衣',
      initiativeId: 'init_guest_lecture',
      stageId: 'stage_4_bureau_check',
      progressPercent: 80,
      startDate: addDays(today, -7),
      endDate: addDays(today, 5),
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_stage_pa_vendor',
      title: 'PA・照明業者 最終見積・機材料金確定',
      description: '雨天時テント養生オプションを含む発注書確定。',
      bureauId: 'bureau_stage',
      teamId: 'team_stage_pa',
      assigneeName: '吉田 拓海',
      initiativeId: 'init_main_stage',
      stageId: 'stage_4_bureau_check',
      progressPercent: 70,
      startDate: addDays(today, -6),
      endDate: addDays(today, 7),
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [
        {
          id: 'att_04',
          title: 'ステージ音響照明 見積比較表',
          category: 'budget',
          url: 'https://docs.google.com/spreadsheets/d/example-stage-quote',
          uploadedBy: '吉田 拓海',
        },
      ],
    },
    {
      id: 'task_stage_rehearsal_tt',
      title: '出演14団体 リハーサル枠・転換表作成',
      description: '各団体のセッティング図回収と当日の袖待機・転換導線の確定。',
      bureauId: 'bureau_stage',
      teamId: 'team_stage_shinko',
      assigneeName: '井上 栞',
      initiativeId: 'init_main_stage',
      stageId: 'stage_3_working',
      progressPercent: 50,
      startDate: addDays(today, -3),
      endDate: addDays(today, 11),
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_stalls_permit_submit',
      title: '模擬店20団体 検便結果・営業届一括提出',
      description: '保健所への臨時営業届および調理マニュアルの確認。',
      bureauId: 'bureau_mogiten',
      teamId: 'team_mogi_eisei',
      assigneeName: '林 健一郎',
      initiativeId: 'init_stalls_hygiene',
      stageId: 'stage_6_done',
      progressPercent: 100,
      startDate: addDays(today, -14),
      endDate: addDays(today, -2),
      isMilestone: true,
      isVerified: true,
      verifiedBy: '財務・衛生統括 木村',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_setup_equipment_order',
      title: '前日設営 レンタルテント・長机数量最終確定',
      description: '模擬店・本部・ステージ用のレンタル備品発注と搬入トラック時間帯指定。',
      bureauId: 'bureau_soumu',
      teamId: 'team_soumu_bihin',
      assigneeName: '伊藤 大輔',
      initiativeId: 'init_festival_days',
      stageId: 'stage_2_planning',
      progressPercent: 25,
      startDate: addDays(today, 2),
      endDate: addDays(today, 15),
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [],
    },
    {
      id: 'task_eco_trash_shift',
      title: 'エコステーション6拠点 回収シフト確定',
      description: '分別回収ルートおよび業者引取時間の共有。',
      bureauId: 'bureau_mogiten',
      teamId: 'team_mogi_eco',
      assigneeName: '加藤 美咲',
      initiativeId: 'init_festival_days',
      stageId: 'stage_1_not_started',
      progressPercent: 0,
      startDate: addDays(today, 10),
      endDate: festivalEnd,
      isMilestone: false,
      isVerified: false,
      verifiedBy: '',
      notes: [],
      attachments: [],
    },
  ];

  return {
    project: {
      name: '第78回 蒼穹祭 実行委員会',
      festivalDate: festivalStart,
      festivalEndDate: festivalEnd,
      description: '複数局・担当が連携する大学祭プロジェクトと担当別タスクの統合ボード',
    },
    bureaus,
    initiatives,
    stages,
    tasks,
  };
}

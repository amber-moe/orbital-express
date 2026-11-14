# Orbital Express：Godot 最小版本开发计划

技术决策：**Godot 4.x 标准版 + GDScript + 2D 场景 + Compatibility 渲染 + 单线程 Web 导出**。开始前检查本机版本与匹配的导出模板，固定版本后不在黑客松中途升级。

本文件落实已确认的“地球发货、太阳系配送、首先实现月球”方案。游戏名为 Orbital Express；原项目方案的文件名仍保留 Lunar_Sling。开发不使用 Vue、Three.js、Node 后端、数据库或 C#。此前有关改用 Web 技术栈的建议不作为实施决策。

## 1. 第一轮只做什么

只做一个可完整游玩的订单 First Delivery：从地球向月球仓库交付建筑物资。一个货舱只能装一种货物。

- 一个地球离心发射站，一个月球接收站。
- 一类货物 Construction Supplies，装货量为 1、2、3 箱。
- 两种保护：Standard / Reinforced；两档机动模块：Small / Large。
- 三个发射预设：Economy / Balanced / Fast。第一轮不开自由角度和速度调节。
- 显示总质量、体积占用、预计能源、受力、机动储备与订单进度。
- 一次发射包含旋转、释放、简化辅助出发、地月飞行、自动制动与接收。
- 有成功和失败结果、具体原因与重试按钮。
- 有来源与模型说明弹窗，无需登录即可在浏览器游玩。

三条预设必须来自同一个模拟器中经过验证的初态，不能手画三条曲线再随机判定成功。预设可固定转速／释放方向／辅助出发方案；实际消耗仍随载重改变。至少一个默认配置完整可行，另一个配置能够展示资源或机动不足。

订单每次开始只给固定库存、能源与预算。合法发射时一次性扣费，成功交付只结算一次。Retry 重置整个订单到初始资源并保留当前配置，不作为无限免费发货；Restart Mission 可恢复默认配置。首轮不做跨订单经济系统。

## 2. 游戏应该长什么样

单屏任务控制台，不做主页、角色选择、复杂设置或独立仓库页面。

| 区域 | 内容 | Godot 实现 |
|---|---|---|
| 顶栏 | 标志、EARTH → MOON、预算、能源 | Control、HBoxContainer、Label |
| 主画面 | 左下地球、右上月球、货舱与轨迹 | Node2D、Sprite2D、Line2D、自定义绘制 |
| 左上任务卡 | First Delivery、交付目标 | PanelContainer、VBoxContainer |
| 左下特写 | 离心机转臂、货舱、释放方向 | Node2D、Sprite2D／自定义绘制、Tween |
| 右侧配置 | 数量、保护、机动模块、发射预设、估算和按钮 | Control、ButtonGroup、Button、ProgressBar |
| 底部进度 | CONFIGURE / LAUNCH / TRANSFER / DELIVER | HBoxContainer 与状态高亮 |
| 弹窗 | 任务结果、说明和来源 | PanelContainer 或 Window |

设计基准为 1600×1000；主画面约占 70%，配置区约占 30%。先支持桌面 1280×720 及以上。使用容器与锚点适配；小高度时配置区允许滚动，不裁掉 Launch 按钮。不做手机专用布局。

配色：背景 #060D18，面板 #0D1926，正文 #E9F0F3，辅助文字 #91A4B5，航线 #4CE4D1，主要按钮 #FFB43B，错误 #FF6B6B。采用清晰的无衬线字体，标题适度字距。细描边、小圆角、局部高光，避免大量模糊和全屏发光。

地球、月球可用二维贴图与简单 CanvasItem shader 做明暗和边缘光；不需要 3D。轨迹、星点、货舱尾迹与旋转特写提供动感。首轮用程序化圆形、线条和简单货箱占位，核心通过后替换素材。素材逐项记录许可；概念效果图只用于参考，不能整张铺成背景来假装界面。

效果图表达布局和氛围，不是精确轨迹、性能承诺或已完成的游戏。游戏画面内不加入真实公司和机构品牌，来源说明单列。生成图片若被用于参赛素材，保留所需生成标记。

## 3. 场景与目录

建议目录：

```text
project.godot
export_presets.cfg
scenes/
  main.tscn
  components/launcher_inset.tscn
  components/result_panel.tscn
scripts/
  main.gd
  mission_controller.gd
  simulation/transfer_simulator.gd
  simulation/departure_model.gd
  simulation/arrival_model.gd
  rules/cargo_rules.gd
  rules/resource_rules.gd
  view/space_view.gd
  view/launcher_view.gd
  ui/config_panel.gd
  ui/result_panel.gd
data/
  physical_constants.json
  cargo.json
  equipment.json
  launch_profiles.json
  contracts.json
assets/
  textures/
  fonts/
  audio/
docs/
  SOURCES.md
  MODEL_NOTES.md
  AI_USAGE.md
  ACCEPTANCE.md
tests/
  run_checks.gd
```

主场景根节点为 Control。使用 MarginContainer、VBoxContainer、HBoxContainer 组织页面。场景区通过专用 Control 内的 Node2D 绘制，space_view.gd 完成物理坐标到屏幕的转换；UI 不自行计算轨迹。保持裁剪正确，装饰节点不要吞掉鼠标输入。无需额外子视口时不引入 SubViewport。

不依赖外部插件、素材商店插件或自动加载单例。MissionController 统一管理状态，界面通过信号发送配置和操作意图。使用带类型的 GDScript，数据加载后集中校验，避免在 UI 文本中重复存常量。

## 4. 状态与数据流

状态：CONFIGURING → SPINNING_UP → DEPARTURE → TRANSFER → APPROACH → RESULT。

- CONFIGURING：允许改配置，重新校验并更新预览；硬性不合法时禁用 Launch。
- SPINNING_UP：锁配置，只扣一次资源，转臂动画约 1–2 秒。
- DEPARTURE：播放虚构辅助出发过程，扣相应机动预算。
- TRANSFER：推进固定步长模拟；绘制货舱位置和尾迹。
- APPROACH：检查并执行有限制动，符合条件才进入接收动画。
- RESULT：停止模拟，显示明确原因，允许重试。

重复点击 Launch 不得重复扣费。隐藏面板、窗口缩放或恢复标签页不能跳过状态判定。物理用固定模拟步长，视觉用插值；窗口尺寸改变只影响绘制变换。

数据流：配置 → 校验与资源估算 → 统一模拟器生成预览与预计结果 → 发射时锁定配置快照 → 同一模拟规则执行 → 统一结算。

## 5. 物理实现与第一优先级风险

最大风险是“好看但没有一条可行的地月路线”。必须先获得可行路线，再做精细 UI。

### 单位与模型

- 地月转移统一用 km、s、km/s、km^3/s^2；离心机用 m、s、kg、J，边界明确换算。
- 使用有来源的地球、月球引力参数，静态地月位置、平方反比引力与速度 Verlet 积分。
- 省略月球运动、太阳引力、地球自转、详细大气与上升过程，来源／模型页明确说明。
- 地表旋转发射在特写中呈现；主模拟起点是虚构辅助上升后的出发状态。用确定的出发模型连接两阶段，记录能耗和机动成本，不免费传送到成功轨迹。
- 离心关系为 v=omega*r，a=v²/r，E=m*v²/(2*efficiency)+fixed_loss。
- 用离散有限 delta-v 简化月球末端制动；只在接近区域触发。接收区域与相对速度条件同时满足才算交付。最终下降可以动画化，不能称为已验证的真实着陆模型。

### 模拟器接口

transfer_simulator.gd 的关键职责：make_initial_state(config)、step(state, dt)、predict(config)、classify_terminal_state(state)。出发与到达计算委托相应模型。predict 与运行时必须复用 step 和事件判定，不重复实现两套物理。

预测时限制步数与最大任务时长。将计算分批到多个帧，避免单线程 Web 卡住。首轮只有离散配置，可按配置键缓存预测结果，配置改变时取消旧预测。加载三条预设及不同载重的已验证初始配置；不要运行时无上限搜索最佳轨道。

高速接近时使用线段与圆／接收区的相交检测，避免大步长穿透。为已知轨迹做步长减半对比，确定能稳定判定的步长；提高播放速度通过多步推进实现，并设置每帧预算，不通过放大 dt 实现。

如果第 12 小时仍未跑通完整路线，缩到一条验证过的 Balanced 预设，保留装货量、保护与机动取舍，其他预设暂时不展示。不用伪造成功结果或转回月面 A → B。

## 6. 开发顺序与验收

| 阶段 | 时间预算 | 具体交付 | 通过标准 |
|---|---|---|---|
| A 项目骨架 | 0–3 小时 | Godot 项目、主场景、占位布局、Web 导出 | 编辑器与浏览器都能运行 |
| B 模拟核心 | 3–10 小时 | 真实参数、出发模型、积分器、接收判定、已知可行配置 | 地球出发并能完成月球交付；失败有原因 |
| C 可玩闭环 | 10–18 小时 | 一类货物、两种保护、两档机动、预设、资源、状态、重试 | 选择会改变结果，扣费与重试一致 |
| D 视觉实现 | 18–26 小时 | 配色、面板、地月贴图、转臂、轨迹、进度、结果 | 按效果图方向形成可演示界面 |
| E 稳定与调参 | 26–34 小时 | 试玩、休息／交接、难度、性能和窗口适配 | 新玩家能理解并完成订单 |
| F 提交 | 34–42 小时 | 英文说明、来源／模型、素材许可、演示 | 公开链接与提交材料齐备 |
| G 缓冲 | 42–48 小时 | 浏览器验证、修复阻塞、正式提交 | 实际赛事截止前确认提交成功 |

先开发 B 的核心，不等 D 美术。第 18 小时应有公开可玩的粗糙版本。剩余时间不足时先砍额外预设、音效、复杂粒子、历史分数及更多货物，保留完整交付循环。实际截止时间优先于以上计划。

## 7. 验证清单

使用简单的 GDScript 无头检查脚本即可，无需先安装测试框架。只测试会影响工程结论和结算的规则。

- 某个已知点的引力方向与大小正确；米／千米换算正确。
- 相同出发位置速度、不同质量的货舱有相同无动力轨迹。
- 预览与实际执行同配置，在同模拟时刻的位置和事件相同。
- 已知路线步长减半后，到达判定和资源结果一致。
- 一组默认配置成功；一组机动不足失败；质量／体积／能源超限禁止发射。
- 高速轨迹不能穿过地球／月球而漏判碰撞。
- 双击发射不重复扣费；重试无残留尾迹和重复信号；结果只结算一次。
- Web 版本在浏览器实际加载，调整窗口后按钮可见，关闭声音仍能游玩。

命令使用本机已验证的 Godot 可执行路径，不假定系统一定叫 godot：编辑器导入、无头解析／运行检查、Web 导出依次完成。导出文件通过 HTTP(S) 服务访问，不通过 file:// 打开。

## 8. Web 导出与部署

采用匹配版本的 Web 导出模板、Compatibility 渲染、GDScript、单线程导出，入口 index.html；不要分别重命名导出文件。先验证安装版本支持的选项，核对 WebGL 2.0、WASM 文件加载和 MIME 配置。首选已有静态托管，不新建后端。测试 Chromium 与 Safari；若有兼容问题，明确记录，至少提供经过验证的演示浏览器。

音效必须可关闭，不依赖自动播放成功。WebGL 初始化失败时显示清楚说明。加载页说明正在加载，导出缓存更新后检查资源版本一致。

官方文档：

- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- https://docs.godotengine.org/en/stable/tutorials/2d/introduction_to_2d.html

## 9. 接下来如何 Vibe coding

把本文件及已确认项目方案放入代码工作区。将下面提示词交给编码助手。第一轮只做 A+B 并报告结果，不要求它一次完成整个游戏。每个阶段完成后保留可运行状态，再追加下一阶段要求。

英文提示词包含必要上下文，可直接复制。它要求实际写文件与验证，不止输出建议。不要自动发布或创建收费账户；公开部署可使用已获授权的平台。

## 10. English coding-agent kickoff prompt

```text
Build the first playable slice of Orbital Express using Godot 4.x Standard, typed GDScript, native 2D scenes, Compatibility rendering, and a single-threaded Web export. Do not use Vue, Three.js, C#, a backend, or third-party game plugins.

Read the repository's AGENTS.md and the supplied project/development plans first. Inspect the installed Godot executable, exact version and available export templates. Pin compatible project settings and record the tested version. Preserve existing work; implement in the designated project directory and do not reorganize unrelated files.

Game concept: a fictional Earth-based centrifuge cargo company delivers to Solar System destinations. This release implements Earth-to-Moon only. All player-facing text is English. Real company/agency names are not part of the fictional story or branding; scientific attribution belongs in separate Sources & Model Notes and documentation.

Minimal scope: one contract named First Delivery, one cargo type Construction Supplies, quantities of 1/2/3 crates, Standard/Reinforced protection, Small/Large maneuver modules, finite credits/energy/inventory, deterministic preview and flight, automatic finite braking, meaningful delivery/failure results and retry. Begin with a single verified Balanced launch profile; add Economy/Fast only after the full slice works. Do not add other planets, mixed cargo, accounts, warehouse construction, multiplayer or manual flight steering.

Use Godot Control containers for a dark mission-control layout: a thin header; a large Earth–Moon playfield on the left; a configuration panel on the right; a centrifugal rotor close-up in the lower-left; a four-step progress strip; a result overlay. Use original procedural placeholders first. Ink/navy backgrounds, readable ivory text, restrained cyan trajectories and amber primary buttons. The visual concept is a reference, not a background image or a physical diagram. Use 2D sprites/shaders later, not 3D scenes.

Architecture: MissionController owns CONFIGURING, SPINNING_UP, DEPARTURE, TRANSFER, APPROACH and RESULT. UI emits intent. Simulation logic is independent of UI/rendering. Data-driven cargo, equipment, contracts, physical constants and launch profiles use validated JSON. Use a shared transfer simulator for prediction and execution, plus departure/arrival models and centralized resource rules.

Physical scope: Earth/Moon are fixed centers with inverse-square gravity. Use consistent km/s units for transfer and explicit meter conversions for the centrifuge. Use documented Earth/Moon gravitational parameters, radii and mean separation. Integrate with a fixed simulation timestep and a stable method such as velocity Verlet. A clearly labeled fictional assisted-ascent mapping connects surface release to the transfer initial state and consumes configured resources. Do not claim the centrifuge alone reaches and lands on the Moon. Use finite tracked maneuver reserve for departure assistance and terminal braking. Use relative arrival speed, a target region, and swept event checks; proximity or collision alone is not delivery. Omit detailed atmosphere, lunar motion and landing guidance and document these omissions. Never fake trajectories with a decorative curve and unrelated success calculation.

Bound prediction work and cache discrete configurations. Do not block Web input with a large synchronous search. Playback acceleration must not change the physics timestep. Changing window size must not change physical results.

For this coding turn, implement stages A and B only:
1. Create/import a runnable project, a placeholder main scene and Web export configuration. Verify a minimal browser build as early as templates allow.
2. Implement the shared deterministic simulation and one documented, reproducible configuration that leaves Earth and satisfies lunar reception criteria under the chosen approximation.
3. Show a trajectory and moving cargo using placeholders. Add a basic Launch/Retry interaction and a clear result. Stub additional configuration controls if necessary; do not claim they work yet.
4. Add meaningful headless GDScript checks for gravity/units, preview-versus-flight consistency, timestep convergence, known success/failure and body intersections.
5. Write README, MODEL_NOTES.md and SOURCES.md. Record real parameters and fictional departure/propulsion assumptions separately. Report files changed, exact validation performed, the known successful configuration and blockers. Do not claim a browser export was tested unless it was actually opened and played.

Actively implement and verify; do not stop at a proposed architecture. If no Godot binary or export templates are available, identify the concrete blocker, continue writing a coherent project and checks where possible, and state precisely what remains unverified. Do not silently switch engines or replace Earth-to-Moon delivery with a Moon-to-Moon game.
```

## 11. 本轮开发定义

这是开发任务书，不表示代码已生成或已运行。当前只有已确认项目方案、概念效果图与本开发计划。下一步先在指定代码目录落实 A+B，得到可验证的粗糙地月发射闭环，再投入精细视觉。

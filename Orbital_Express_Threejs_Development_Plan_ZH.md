# Orbital Express：Three.js 最小版本开发计划

技术决策：**Vue 3 + TypeScript + Vite + Three.js + HTML/CSS**。Vue 负责配置和任务界面，Three.js 负责太空场景与动画，独立 TypeScript 模块负责二维物理和任务规则。开始前核对 Node.js 与所选 Vite 版本的兼容要求，使用一种包管理器并提交锁文件，黑客松中途不随意升级依赖。

本文件落实已确认的“地球发货、太阳系配送、首先实现月球”方案。游戏名为 Orbital Express；原项目方案的文件名仍保留 Lunar_Sling。采用浏览器本地运行的纯前端架构，不需要游戏服务器、数据库或账户。当前技术选择覆盖此前的引擎建议。这里只修改开发文档，不表示代码已实现。

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

| 区域 | 内容 | 实现方式 |
|---|---|---|
| 顶栏 | 标志、EARTH → MOON、预算、能源 | Vue 组件、HTML、CSS Flex |
| 主画面 | 左下地球、右上月球、货舱与轨迹 | Three.js WebGLRenderer、OrthographicCamera、Mesh、线条 |
| 左上任务卡 | First Delivery、交付目标 | HTML/CSS 浮层 |
| 左下特写 | 离心机转臂、货舱、释放方向 | SVG 与 CSS 动画，或共用 Three.js renderer 的局部视口 |
| 右侧配置 | 数量、保护、机动模块、预设、估算和按钮 | Vue 表单、原生按钮、CSS 进度条 |
| 底部进度 | CONFIGURE / LAUNCH / TRANSFER / DELIVER | Vue 组件与状态高亮 |
| 弹窗 | 任务结果、说明和来源 | HTML dialog 或可访问的 Vue 模态组件 |

设计基准为 1600×1000；主画面约占 70%，配置区约占 30%。先支持桌面 1280×720 及以上。使用 CSS Grid/Flex、相对尺寸和断点适配；小高度时配置区允许滚动，不裁掉 Launch 按钮。不做手机专用布局。

配色：背景 #060D18，面板 #0D1926，正文 #E9F0F3，辅助文字 #91A4B5，航线 #4CE4D1，主要按钮 #FFB43B，错误 #FF6B6B。采用清晰的无衬线字体，标题适度字距。细描边、小圆角、局部高光，避免大量模糊和全屏发光。

玩法和物理限制在 XY 平面，使用正交相机。地球、月球可用 SphereGeometry、贴图、基础光照与轻量边缘光表现立体质感，货舱用简单几何体。首轮不做自由旋转相机、复杂 3D 模型或后期泛光管线。轨迹、星点、货舱尾迹与旋转特写提供动感。首轮用程序化圆形、线条和简单货箱占位，核心通过后替换素材。素材逐项记录许可；概念效果图只用于参考，不能整张铺成背景来假装界面。

效果图表达布局和氛围，不是精确轨迹、性能承诺或已完成的游戏。游戏画面内不加入真实公司和机构品牌，来源说明单列。生成图片若被用于参赛素材，保留所需生成标记。

## 3. 模块与目录

建议目录：

```text
package.json
package-lock.json
index.html
vite.config.ts
tsconfig.json
src/
  main.ts
  App.vue
  styles/tokens.css
  components/
    MissionHeader.vue
    SpaceViewport.vue
    ContractCard.vue
    LauncherInset.vue
    ConfigPanel.vue
    MissionProgress.vue
    ResultDialog.vue
    SourcesDialog.vue
  game/
    types.ts
    missionController.ts
    simulation/transferSimulator.ts
    simulation/departureModel.ts
    simulation/arrivalModel.ts
    rules/cargoRules.ts
    rules/resourceRules.ts
  rendering/
    createSpaceScene.ts
    coordinateTransform.ts
    trajectoryView.ts
  composables/useMission.ts
  data/
    physicalConstants.json
    cargo.json
    equipment.json
    launchProfiles.json
    contracts.json
public/assets/
  textures/
  fonts/
  audio/
docs/
  SOURCES.md
  MODEL_NOTES.md
  AI_USAGE.md
  ACCEPTANCE.md
tests/
  simulation.test.ts
  missionRules.test.ts
```

App.vue 用 CSS Grid 组织主画面和配置区。SpaceViewport.vue 管理画布挂载、尺寸监听与销毁；Three.js 场景与镜头由 rendering 模块管理，coordinateTransform.ts 只负责物理坐标到视觉坐标的映射。UI 不自行计算轨迹，物理模块不导入 Vue、Three.js 或 DOM。

MissionController 管理状态，useMission 将低频状态暴露给 Vue。高频位置、粒子和相机数据留在渲染循环，不把所有 Three.js 对象变成深层响应式对象。首轮无需 Pinia、路由、额外物理引擎、3D 模型加载框架或 UI 组件库。

requestAnimationFrame 驱动绘制；累计模拟时间后按固定 dt 执行物理步进，每帧设置预算。标签页隐藏时暂停，返回时丢弃异常的大墙钟时间差，避免瞬间模拟数小时。ResizeObserver 更新 renderer 与相机，不改物理状态。组件卸载时停止循环、移除监听器并释放几何体、材质和贴图。

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

transferSimulator.ts 的关键职责：makeInitialState(config)、step(state, dt)、predict(config)、classifyTerminalState(state)。出发与到达计算委托相应模型。predict 与运行时必须复用 step 和事件判定，不重复实现两套物理。

预测时限制步数与最大任务时长。将计算分批到多个帧，避免单线程 Web 卡住。首轮只有离散配置，可按配置键缓存预测结果，配置改变时取消旧预测。加载三条预设及不同载重的已验证初始配置；不要运行时无上限搜索最佳轨道。

高速接近时使用线段与圆／接收区的相交检测，避免大步长穿透。为已知轨迹做步长减半对比，确定能稳定判定的步长；提高播放速度通过多步推进实现，并设置每帧预算，不通过放大 dt 实现。

如果第 12 小时仍未跑通完整路线，缩到一条验证过的 Balanced 预设，保留装货量、保护与机动取舍，其他预设暂时不展示。不用伪造成功结果或转回月面 A → B。

## 6. 开发顺序与验收

| 阶段 | 时间预算 | 具体交付 | 通过标准 |
|---|---|---|---|
| A 项目骨架 | 0–3 小时 | Vue/TS/Vite 项目、Three.js 画布、占位布局、静态构建 | 开发服务与生产预览均能运行 |
| B 模拟核心 | 3–10 小时 | 真实参数、出发模型、积分器、接收判定、已知可行配置 | 地球出发并能完成月球交付；失败有原因 |
| C 可玩闭环 | 10–18 小时 | 一类货物、两种保护、两档机动、预设、资源、状态、重试 | 选择会改变结果，扣费与重试一致 |
| D 视觉实现 | 18–26 小时 | 配色、面板、地月贴图、转臂、轨迹、进度、结果 | 按效果图方向形成可演示界面 |
| E 稳定与调参 | 26–34 小时 | 试玩、休息／交接、难度、性能和窗口适配 | 新玩家能理解并完成订单 |
| F 提交 | 34–42 小时 | 英文说明、来源／模型、素材许可、演示 | 公开链接与提交材料齐备 |
| G 缓冲 | 42–48 小时 | 浏览器验证、修复阻塞、正式提交 | 实际赛事截止前确认提交成功 |

先开发 B 的核心，不等 D 美术。第 18 小时应有公开可玩的粗糙版本。剩余时间不足时先砍额外预设、音效、复杂粒子、历史分数及更多货物，保留完整交付循环。实际截止时间优先于以上计划。

## 7. 验证清单

使用 Vitest 验证独立 TypeScript 模拟和任务规则。只测试会影响工程结论、事件和结算的行为，不为装饰样式逐项写测试。浏览器烟测可使用已有自动化工具，或记录手动验证结果。

- 某个已知点的引力方向与大小正确；米／千米换算正确。
- 相同出发位置速度、不同质量的货舱有相同无动力轨迹。
- 预览与实际执行同配置，在同模拟时刻的位置和事件相同。
- 已知路线步长减半后，到达判定和资源结果一致。
- 一组默认配置成功；一组机动不足失败；质量／体积／能源超限禁止发射。
- 高速轨迹不能穿过地球／月球而漏判碰撞。
- 双击发射不重复扣费；重试无残留尾迹和重复信号；结果只结算一次。
- Web 版本在浏览器实际加载，调整窗口后按钮可见，关闭声音仍能游玩。

工程提供 dev、typecheck、test、build、preview 脚本。若采用 npm，依次验证 npm run typecheck、npm run test -- --run、npm run build，再通过 npm run preview 打开生产构建。Node.js 仅用于本地开发／构建工具，线上无需 Node.js 服务。通过 HTTP(S) 访问，不通过 file:// 打开。

## 8. 浏览器构建与静态部署

Vite 产出 dist 静态目录。将整个目录部署到已有静态托管即可，无需游戏后端、引擎导出模板或账户系统。部署在子路径时验证 Vite base 与素材路径，不能只验证开发服务器。

浏览器第一次打开仍会加载 JavaScript、贴图、字体、音效；这是首次加载资源，不是让用户手动安装游戏。体积与速度需要实际测量，不预先保证 Three.js 版本一定更小。首轮不引入大模型、4K/8K 全套贴图或大型音频；素材优先本地打包并记录许可，不依赖不稳定的跨站热链。

Three.js 每帧只更新需要变化的对象；限制像素比，例如 Math.min(devicePixelRatio, 1.5)，限制星点／尾迹数量，不反复创建几何体。轨迹缓存复用，首次验证后再增加特效。桌面目标为稳定交互，记录实测设备与帧率，不凭设计稿宣称性能达标。

音效可关闭，播放需遵守浏览器用户手势限制。WebGL 初始化失败时显示清楚说明，加载资源失败提供重试。验证 Chromium 与 Safari、窗口缩放、标签页切换、生产资源路径及无网络 API 依赖的核心流程。

官方文档：

- https://threejs.org/docs/
- https://vite.dev/guide/
- https://vite.dev/guide/static-deploy.html
- https://vuejs.org/guide/typescript/overview.html
- https://vitest.dev/guide/

## 9. 接下来如何 Vibe coding

把本文件及已确认项目方案放入代码工作区。将下面提示词交给编码助手。第一轮只做 A+B 并报告结果，不要求它一次完成整个游戏。每个阶段完成后保留可运行状态，再追加下一阶段要求。

英文提示词包含必要上下文，可直接复制。它要求实际写文件与验证，不止输出建议。不要自动发布或创建收费账户；公开部署可使用已获授权的平台。

## 10. English coding-agent kickoff prompt

```text
Build the first playable slice of Orbital Express using Vue 3, strict TypeScript, Vite and Three.js. Use HTML/CSS for the UI, an orthographic Three.js scene for visuals, and a standalone TypeScript module for two-dimensional physics. Do not use a different game engine, a backend, a database, accounts, multiplayer, a routing system or an additional physics engine.

Read the repository's AGENTS.md and the supplied project/development plans first. Inspect the existing project and installed Node/package manager versions. Preserve existing work. Select mutually compatible dependencies, commit one lockfile, and provide dev, typecheck, test, build and preview scripts. Record tested versions; do not assume current API compatibility from memory.

Game concept: a fictional Earth-based centrifuge cargo company delivers to Solar System destinations. This release implements Earth-to-Moon only. All player-facing text is English. Real company/agency names do not appear in the story or branding; scientific attribution belongs in Sources & Model Notes and repository documentation.

Minimal scope: one contract named First Delivery; Construction Supplies only; quantities of 1/2/3 crates; Standard/Reinforced protection; Small/Large maneuver modules; finite credits/energy/inventory; deterministic preview/flight; finite automatic braking; meaningful delivery/failure results and retry. Begin with one verified Balanced launch profile. Add Economy/Fast only after the full slice works. No other destinations, mixed cargo, warehouse construction or manual flight steering.

Visual target: a dark mission-control screen, thin header, large Earth–Moon playfield on the left, configuration panel on the right, a centrifugal rotor inset at lower-left, four-step progress strip and a result overlay. Use CSS Grid/Flex and native accessible controls. Ink/navy surfaces, readable ivory text, cyan trajectories and amber launch buttons. Use original placeholders first. The supplied concept is a layout/style reference, not a full-screen background or a physical chart. Planet sphere meshes may provide visual depth, but all game motion remains in the XY plane. No free camera controls or heavy postprocessing.

Architecture: MissionController owns CONFIGURING, SPINNING_UP, DEPARTURE, TRANSFER, APPROACH and RESULT. Keep simulation independent of Vue, Three.js and DOM. Use validated JSON for constants, cargo, equipment, contracts and profiles. Preview and live flight share the same step and terminal-event logic. Vue manages low-frequency interface state. The render loop owns high-frequency transforms; do not deeply proxy the entire Three.js scene.

Physics: fixed Earth/Moon centers, inverse-square gravity, consistent km/s units with explicit meter conversions for centrifuge calculations, and a fixed timestep with a stable integrator such as velocity Verlet. Source and document gravitational parameters, radii and mean separation. A clearly labeled fictional assisted-ascent mapping connects surface release to a transfer initial state, consumes resources and must not turn arbitrary bad shots into success. Track finite departure/braking reserve. Accept delivery only inside the receiving zone with valid relative speed and sufficient braking; collision/proximity alone is not success. Document omitted atmosphere, lunar motion, solar gravity and landing guidance. Never use a decorative curve with unrelated random success rules.

Bound prediction work, cancel obsolete predictions and cache discrete configurations. Playback speed must not alter the physics timestep. Resize changes rendering only. Pause on hidden tabs and discard large resume-time deltas. Avoid unnecessary workers for the first version. Dispose rendering resources and listeners on unmount. Cap device pixel ratio and effects, and measure production loading/performance rather than assuming it is lightweight.

For this coding turn implement stages A and B only:
1. Create a runnable Vue/TS/Vite shell, a Three.js viewport, placeholder layout and a production build. Verify with the production preview server early.
2. Implement shared deterministic simulation and one documented reproducible configuration that leaves Earth and meets lunar reception criteria under the stated approximation.
3. Draw the predicted trajectory and animate the cargo. Add basic Launch/Retry and a clear result. Stub additional configuration controls if needed and state what is not wired yet.
4. Add meaningful Vitest checks for gravity/units, prediction/live equivalence, timestep convergence, known success/failure and swept body intersections.
5. Write README, MODEL_NOTES.md and SOURCES.md. Keep real inputs and fictional departure/propulsion assumptions separate. Run type checking, tests and production build. Open and exercise the browser version when tooling is available. Report changed files, exact verification, the known successful configuration and blockers.

Actively implement and verify rather than stopping at an architecture proposal. Do not claim browser testing without opening and exercising the build. If dependencies/tooling are unavailable, explain the concrete blocker and continue independent work where possible. Do not silently change the stack or replace Earth-to-Moon delivery with Moon-to-Moon transport. Do not deploy publicly or create paid accounts without applicable user authorization.

```

## 11. 本轮开发定义

这是开发任务书，不表示代码已生成或已运行。当前只有已确认项目方案、概念效果图与本开发计划。下一步先在指定代码目录落实 A+B，得到可验证的粗糙地月发射闭环，再投入精细视觉。技术选择已确定为 Three.js，项目方案的中英文版本同步采用这一选择。

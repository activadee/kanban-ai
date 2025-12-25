## [0.19.4](https://github.com/activadee/kanban-ai/compare/v0.19.3...v0.19.4) (2025-12-25)

### Bug Fixes

* **client:** prevent resizable panel layout crash ([#317](https://github.com/activadee/kanban-ai/issues/317)) ([db1bf18](https://github.com/activadee/kanban-ai/commit/db1bf1852a482ada8a108b8114912d75851a6d56))

## [0.19.3](https://github.com/activadee/kanban-ai/compare/v0.19.2...v0.19.3) (2025-12-24)

### Bug Fixes

* **cli:** avoid hard fail on GitHub rate limits ([#316](https://github.com/activadee/kanban-ai/issues/316)) ([d0a21dd](https://github.com/activadee/kanban-ai/commit/d0a21ddc3669efa7848aeca93e69da439a1b42c9))

## [0.19.2](https://github.com/activadee/kanban-ai/compare/v0.19.1...v0.19.2) (2025-12-23)

### Bug Fixes

* **opencode:** stream messages while running ([#314](https://github.com/activadee/kanban-ai/issues/314)) ([cf1f612](https://github.com/activadee/kanban-ai/commit/cf1f612a977b591995aed2854142e0fa96f40ed7))

## [0.19.1](https://github.com/activadee/kanban-ai/compare/v0.19.0...v0.19.1) (2025-12-22)

### Bug Fixes

* **opencode:** restore thinking blocks in UI ([a63e097](https://github.com/activadee/kanban-ai/commit/a63e0979b8f049da0ddfc184b80df7e0d049f46e))

## [0.19.0](https://github.com/activadee/kanban-ai/compare/v0.18.0...v0.19.0) (2025-12-22)

### Features

* add enhanced ticket indicator with is_enhanced field ([#285](https://github.com/activadee/kanban-ai/issues/285)) ([37a1b97](https://github.com/activadee/kanban-ai/commit/37a1b978f5ec9114a7c5cba76192c5fbec5a798f))
* **codex:** enhance debug logging with configurable verbosity and structured output ([#289](https://github.com/activadee/kanban-ai/issues/289)) ([41add12](https://github.com/activadee/kanban-ai/commit/41add12a55aa006eb40aa84fd5238ea807ec858a))
* implement auto-close GitHub tickets on PR merge ([#283](https://github.com/activadee/kanban-ai/issues/283)) ([bc32115](https://github.com/activadee/kanban-ai/commit/bc321159f10037e0106a51a1a658921a0067c866))
* make thinking blocks collapsible with improved styling ([#293](https://github.com/activadee/kanban-ai/issues/293)) ([8ed3277](https://github.com/activadee/kanban-ai/commit/8ed3277e9016a7b6edba8227d659b7af6ba750bd))
* **pr-summary:** auto-link GitHub issues in PR summaries ([#286](https://github.com/activadee/kanban-ai/issues/286)) ([334c704](https://github.com/activadee/kanban-ai/commit/334c704563fe7afcca4ce63db7368d80d4e9ec1c))

### Bug Fixes

* **client:** unblock client build in CI ([ee681b9](https://github.com/activadee/kanban-ai/commit/ee681b9e2655fd671d93b884bbda707bdea3abec))

### Refactors

* **client:** unify page headers across application ([#292](https://github.com/activadee/kanban-ai/issues/292)) ([cca65a1](https://github.com/activadee/kanban-ai/commit/cca65a1c762e096d8d13078c228f4675c9f35549))

### Build

* **deps:** bump @openai/codex-sdk from 0.71.0 to 0.77.0 ([#312](https://github.com/activadee/kanban-ai/issues/312)) ([ecd2d7c](https://github.com/activadee/kanban-ai/commit/ecd2d7ccbe9137af7f9a96de5d4f5f5926f09adf))
* **deps:** bump @openai/codex-sdk from 0.71.0 to 0.77.0 in /core ([#313](https://github.com/activadee/kanban-ai/issues/313)) ([ae64f36](https://github.com/activadee/kanban-ai/commit/ae64f368161cc9211a645d394a5ac6a652df2d2b))
* **deps:** bump lucide-react from 0.560.0 to 0.562.0 ([#307](https://github.com/activadee/kanban-ai/issues/307)) ([8dcaf97](https://github.com/activadee/kanban-ai/commit/8dcaf97e3c218849a2de19c146ca87203013c38e))
* **deps:** bump lucide-react from 0.560.0 to 0.562.0 in /client ([#305](https://github.com/activadee/kanban-ai/issues/305)) ([b191fef](https://github.com/activadee/kanban-ai/commit/b191fefba8ad426cb8a03cf18ea4e67491e87fab))
* **deps:** bump react-resizable-panels from 3.0.6 to 4.0.14 ([#310](https://github.com/activadee/kanban-ai/issues/310)) ([a484f88](https://github.com/activadee/kanban-ai/commit/a484f8892bad932d6eddb4e48b68310b0392836e))
* **deps:** bump react-resizable-panels from 3.0.6 to 4.0.14 in /client ([#311](https://github.com/activadee/kanban-ai/issues/311)) ([d256088](https://github.com/activadee/kanban-ai/commit/d2560887f303956384aacca12b2a807c4c7c457e))

### CI

* **review:** change to high reasoning in review ([b6a57b0](https://github.com/activadee/kanban-ai/commit/b6a57b08791188d4888de72c933e3a1b77af85db))
* **review:** use gpt-5.2 xhigh for reviews ([#277](https://github.com/activadee/kanban-ai/issues/277)) ([e1e9fd0](https://github.com/activadee/kanban-ai/commit/e1e9fd0739fc3632fbe3a62dfa0861b4e3d84ecd))

## [0.18.0](https://github.com/activadee/kanban-ai/compare/v0.17.0...v0.18.0) (2025-12-12)

### Features

* allow scripts to fail ([#275](https://github.com/activadee/kanban-ai/issues/275)) ([ec8dfae](https://github.com/activadee/kanban-ai/commit/ec8dfae7a3fb56f0070e17c5c7484cc5bab08c54))
* enhance GitHub sync with issue export on ticket creation ([#276](https://github.com/activadee/kanban-ai/issues/276)) ([b90e08c](https://github.com/activadee/kanban-ai/commit/b90e08cd17402b0046e7bfd03b8ebad60a6670b3))

## [0.17.0](https://github.com/activadee/kanban-ai/compare/v0.16.1...v0.17.0) (2025-12-12)

### Features

* **core:** add OPENCODE inline agent for PR ticket enhancement ([#270](https://github.com/activadee/kanban-ai/issues/270)) ([38c32a1](https://github.com/activadee/kanban-ai/commit/38c32a12c7977afaec0fbd3bfa065c42c1da5df0))
* support `xhigh` reasoning level in SDK ([#269](https://github.com/activadee/kanban-ai/issues/269)) ([525bc8f](https://github.com/activadee/kanban-ai/commit/525bc8f1b6f102ec3da490087248ce5898f381ca))

### Build

* **deps:** bump @openai/codex-sdk from 0.69.0 to 0.71.0 ([#272](https://github.com/activadee/kanban-ai/issues/272)) ([6b24fe3](https://github.com/activadee/kanban-ai/commit/6b24fe3a41b5d740aae4c8de86f97e9aa2097a4f))
* **deps:** bump @openai/codex-sdk from 0.69.0 to 0.71.0 in /core ([#274](https://github.com/activadee/kanban-ai/issues/274)) ([6260a19](https://github.com/activadee/kanban-ai/commit/6260a1947fc414be0248affd0a3a277f6038607e))
* **deps:** bump lucide-react from 0.559.0 to 0.560.0 ([#273](https://github.com/activadee/kanban-ai/issues/273)) ([e84e235](https://github.com/activadee/kanban-ai/commit/e84e235f1ed8dea0289e236f29db44a0fedd5ef8))
* **deps:** bump lucide-react from 0.559.0 to 0.560.0 in /client ([#271](https://github.com/activadee/kanban-ai/issues/271)) ([ba5f8c2](https://github.com/activadee/kanban-ai/commit/ba5f8c2c6e359fe297ed29bd8ce4d326d05caeef))

## [0.16.1](https://github.com/activadee/kanban-ai/compare/v0.16.0...v0.16.1) (2025-12-11)

### Bug Fixes

* profile issues & docs ([0091628](https://github.com/activadee/kanban-ai/commit/0091628c0021812bdfc7aee3c4dc6383af56cf36))

### Refactors

* dashboard reformat ([61994d2](https://github.com/activadee/kanban-ai/commit/61994d2122e91250b3b5739d0608ad285854dcda))
* Make dashboard lists scrollable and improve InboxPanel layout ([7649b4b](https://github.com/activadee/kanban-ai/commit/7649b4b1f5b30125953c3d20b307118c42a53b6d))

## [0.16.0](https://github.com/activadee/kanban-ai/compare/v0.15.0...v0.16.0) (2025-12-11)

### Features

*  Expose dashboard overview via REST and WebSocket ([#249](https://github.com/activadee/kanban-ai/issues/249)) ([bfd5064](https://github.com/activadee/kanban-ai/commit/bfd5064717c4b4eeb22b9d959c3a0e9a77f36b41))
* Add dashboard deep links to attempts and project boards ([#267](https://github.com/activadee/kanban-ai/issues/267)) ([c674ecc](https://github.com/activadee/kanban-ai/commit/c674ecc2604796a4c9ab90811b67eff4d8956975))
* Add loading, empty, and error states for Mission Control dashboard ([#265](https://github.com/activadee/kanban-ai/issues/265)) ([34578c9](https://github.com/activadee/kanban-ai/commit/34578c90fd146cbd98e2d368b71e74ecc9a69cfe))
* Agent Profile Splitting for Inline Tasks ([#233](https://github.com/activadee/kanban-ai/issues/233)) ([72b930a](https://github.com/activadee/kanban-ai/commit/72b930a40b425920aab3a1f54e435fce3d9fef62))
* **client:** implement Mission Control dashboard layout skeleton ([#251](https://github.com/activadee/kanban-ai/issues/251)) ([d249fcb](https://github.com/activadee/kanban-ai/commit/d249fcbfd481b1fd7474150a27a57c4fe9a36acf))
* **dashboard:** add agents & system status panel ([#262](https://github.com/activadee/kanban-ai/issues/262)) ([4d85da8](https://github.com/activadee/kanban-ai/commit/4d85da80e3be1a89693ad3efb9d30440843cb373))
* **dashboard:** add project health panel to overview ([#261](https://github.com/activadee/kanban-ai/issues/261)) ([b1921d3](https://github.com/activadee/kanban-ai/commit/b1921d3197bbfdcfc533e1d8ae1b6c4be1550813))
* **dashboard:** add recent attempt history panel ([#264](https://github.com/activadee/kanban-ai/issues/264)) ([83ed132](https://github.com/activadee/kanban-ai/commit/83ed132e9b54ce546ac1eeb7269ed11673a3c7ca))
* **dashboard:** aggregate per-agent statistics for the system status panel ([#248](https://github.com/activadee/kanban-ai/issues/248)) ([6735727](https://github.com/activadee/kanban-ai/commit/67357270410a2abe49266bc0695bba2fe8e0bfcd))
* **dashboard:** bind KPI cards to dashboard metrics ([#252](https://github.com/activadee/kanban-ai/issues/252)) ([9a9f6e5](https://github.com/activadee/kanban-ai/commit/9a9f6e5bc6a44ee6f3992e7822961b0f3f01654d))
* **dashboard:** extend project snapshots with project health metrics ([#247](https://github.com/activadee/kanban-ai/issues/247)) ([f713b8c](https://github.com/activadee/kanban-ai/commit/f713b8c8c4aca9a42d84e1be31c5424bde4f10e7))
* Implement Dashboard Inbox Panel UI for Review and Failed Attempts ([#260](https://github.com/activadee/kanban-ai/issues/260)) ([d92e218](https://github.com/activadee/kanban-ai/commit/d92e2189f609b3e880c481ad9489a663130eee67))
* Implement live agent activity panel with real-time updates ([#259](https://github.com/activadee/kanban-ai/issues/259)) ([c1f604d](https://github.com/activadee/kanban-ai/commit/c1f604dc2f0e882374030f2cc2a71ac194eea34c))
* Implement time-range aware dashboard overview service ([#243](https://github.com/activadee/kanban-ai/issues/243)) ([2550ba2](https://github.com/activadee/kanban-ai/commit/2550ba2bc39ee826fb08819c0332bf3bbee342f9))
* Make Mission Control dashboard responsive for small screens ([#266](https://github.com/activadee/kanban-ai/issues/266)) ([cc089c0](https://github.com/activadee/kanban-ai/commit/cc089c0054437ee4832713b11948a0e4cc945800))
* re-enable opencode adn rewrite to use sdk ([#241](https://github.com/activadee/kanban-ai/issues/241)) ([67510ab](https://github.com/activadee/kanban-ai/commit/67510ab4fe5e11fe69ba76cbd314712c0509bf60))
* Wire dashboard time range filter to API and persist selection ([#263](https://github.com/activadee/kanban-ai/issues/263)) ([f6cef8f](https://github.com/activadee/kanban-ai/commit/f6cef8f345d828cc85f0cd82fbe16ec2805519f7))

### Chores

* Define Mission Control dashboard API data model and wire through server + client ([#242](https://github.com/activadee/kanban-ai/issues/242)) ([2730fba](https://github.com/activadee/kanban-ai/commit/2730fba60bac6d169743e98985eabbbc4713c8c0))
* Implement inbox aggregation for review and failed attempts ([#246](https://github.com/activadee/kanban-ai/issues/246)) ([7a6ed05](https://github.com/activadee/kanban-ai/commit/7a6ed05d63347f6dff81e3725b20a58420d9504f))

### Docs

* document Mission Control dashboard for users and contributors ([#268](https://github.com/activadee/kanban-ai/issues/268)) ([b9b9d25](https://github.com/activadee/kanban-ai/commit/b9b9d25d1d5cced370f7964738870957abff4419))

### Refactors

* **server:** remove Prisma and standardize on Drizzle ([#245](https://github.com/activadee/kanban-ai/issues/245)) ([f3c9c2e](https://github.com/activadee/kanban-ai/commit/f3c9c2e2a8e9abd6151b0b687648b7f549f54f2d))

### Tests

* Add comprehensive dashboard overview and inbox tests ([#250](https://github.com/activadee/kanban-ai/issues/250)) ([86b6641](https://github.com/activadee/kanban-ai/commit/86b6641918a63830ccea088eaf568983649818e9))

### Build

* **deps-dev:** bump @types/node from 24.10.3 to 25.0.0 ([#256](https://github.com/activadee/kanban-ai/issues/256)) ([8f48657](https://github.com/activadee/kanban-ai/commit/8f48657cb0635351220d1e0343518c84410196a6))
* **deps-dev:** bump @types/node from 24.10.3 to 25.0.0 in /client ([#253](https://github.com/activadee/kanban-ai/issues/253)) ([473632a](https://github.com/activadee/kanban-ai/commit/473632ab98b735b391b57ac78d60a1e643d56db1))
* **deps:** bump @openai/codex-sdk from 0.64.0 to 0.65.0 in /core ([#237](https://github.com/activadee/kanban-ai/issues/237)) ([5727215](https://github.com/activadee/kanban-ai/commit/57272153d5c8ab30ee5f0c529fccca125f6164a0))
* **deps:** bump @openai/codex-sdk from 0.65.0 to 0.66.0 in /core ([#244](https://github.com/activadee/kanban-ai/issues/244)) ([03caaba](https://github.com/activadee/kanban-ai/commit/03caaba36c6d7e7261ce226f5ab367165172b494))
* **deps:** bump @openai/codex-sdk from 0.66.0 to 0.69.0 ([#257](https://github.com/activadee/kanban-ai/issues/257)) ([afd76b9](https://github.com/activadee/kanban-ai/commit/afd76b96221779d07ffe625b4005c16c49e499d5))
* **deps:** bump @openai/codex-sdk from 0.66.0 to 0.69.0 in /core ([#258](https://github.com/activadee/kanban-ai/issues/258)) ([6827d21](https://github.com/activadee/kanban-ai/commit/6827d215062b3f282a910a0e3415539a94614cb2))
* **deps:** bump drizzle-orm from 0.44.7 to 0.45.0 in /core ([#238](https://github.com/activadee/kanban-ai/issues/238)) ([8fbdbc7](https://github.com/activadee/kanban-ai/commit/8fbdbc7a5ecc4943af6b7e913b3a34fdad5b97b9))
* **deps:** bump drizzle-orm from 0.44.7 to 0.45.0 in /server ([#236](https://github.com/activadee/kanban-ai/issues/236)) ([30c5fab](https://github.com/activadee/kanban-ai/commit/30c5fab6263fa0a8792e979a0c992149b9a0bfa3))
* **deps:** bump lucide-react from 0.555.0 to 0.556.0 in /client ([#240](https://github.com/activadee/kanban-ai/issues/240)) ([603056d](https://github.com/activadee/kanban-ai/commit/603056db235c1c5c2aa001abc4d80a869371f01e))
* **deps:** bump lucide-react from 0.556.0 to 0.559.0 ([#254](https://github.com/activadee/kanban-ai/issues/254)) ([95094ce](https://github.com/activadee/kanban-ai/commit/95094ce4c03aff1454df10e5d01677575aebc424))
* **deps:** bump lucide-react from 0.556.0 to 0.559.0 in /client ([#255](https://github.com/activadee/kanban-ai/issues/255)) ([35e289b](https://github.com/activadee/kanban-ai/commit/35e289b60aa55a39f64b4ebd76562c202a5eab91))

## [0.15.0](https://github.com/activadee/kanban-ai/compare/v0.14.1...v0.15.0) (2025-12-03)

### Features

* **server:** migrate migrations from drizzle to prisma ([#211](https://github.com/activadee/kanban-ai/issues/211)) ([08f61bb](https://github.com/activadee/kanban-ai/commit/08f61bbaef89bb4788a927222540ee43855a3f2a))

## [0.14.1](https://github.com/activadee/kanban-ai/compare/v0.14.0...v0.14.1) (2025-12-03)

### Bug Fixes

* harden project settings date parsing ([a29766c](https://github.com/activadee/kanban-ai/commit/a29766c358e4ed227b571dd4d48fd11e9dbfc4cd))

### Tests

* cover project settings date normalization ([7b8dc0e](https://github.com/activadee/kanban-ai/commit/7b8dc0efce21b7fb3139cc667b9ed39a06aef7a1))

## [0.14.0](https://github.com/activadee/kanban-ai/compare/v0.13.0...v0.14.0) (2025-12-03)

### Features

* **github-sync:** add scheduled GitHub issue sync for project boards ([#210](https://github.com/activadee/kanban-ai/issues/210)) ([b775cf9](https://github.com/activadee/kanban-ai/commit/b775cf9cd10078c3c2d9f8716a3bb1df388be21e)), closes [owner/repo/#number](https://github.com/owner/repo//issues/number)

### Chores

* bun.lock ([39962bc](https://github.com/activadee/kanban-ai/commit/39962bc59f325cc4d3396de1306b04990038a81d))

### Build

* **deps:** bump @openai/codex-sdk from 0.63.0 to 0.64.0 ([#208](https://github.com/activadee/kanban-ai/issues/208)) ([1f24cee](https://github.com/activadee/kanban-ai/commit/1f24cee12b5fc7b047c4bb93778b96e2bd7da608))
* **deps:** bump @openai/codex-sdk from 0.63.0 to 0.64.0 in /core ([#209](https://github.com/activadee/kanban-ai/issues/209)) ([5384838](https://github.com/activadee/kanban-ai/commit/5384838834a3263eb0c62ac291198bd4dcdb3944))
* **deps:** bump actions/setup-node from 4 to 6 ([#206](https://github.com/activadee/kanban-ai/issues/206)) ([5fd922e](https://github.com/activadee/kanban-ai/commit/5fd922e03efdc3899f267a0543438c63be83bd88))
* **deps:** bump amannn/action-semantic-pull-request from 5 to 6 ([#207](https://github.com/activadee/kanban-ai/issues/207)) ([5e9ce6a](https://github.com/activadee/kanban-ai/commit/5e9ce6a62a7298d00e16613aaf25d96e2ac6ac25))

## [0.13.0](https://github.com/activadee/kanban-ai/compare/v0.12.0...v0.13.0) (2025-11-30)

### Features

* **server:** use separate dev SQLite database file ([#204](https://github.com/activadee/kanban-ai/issues/204)) ([ca96d3e](https://github.com/activadee/kanban-ai/commit/ca96d3e8d3ddfb4a2bd36af56fbc0ac5fb11decc))

### Bug Fixes

* client build ([14c8b62](https://github.com/activadee/kanban-ai/commit/14c8b62d3de785c37c56454511010b4064c1c1c1))
* keep board scrollable with resizable inspector ([#205](https://github.com/activadee/kanban-ai/issues/205)) ([6281d03](https://github.com/activadee/kanban-ai/commit/6281d03f5467da671133583fdae367cb0c6a01a8))

### Refactors

* move card inspector attempt actions into header ([#203](https://github.com/activadee/kanban-ai/issues/203)) ([ce0df3a](https://github.com/activadee/kanban-ai/commit/ce0df3a4857385c817f6ee848a1b643a09c40a18))

## [0.12.0](https://github.com/activadee/kanban-ai/compare/v0.11.1...v0.12.0) (2025-11-30)

### Features

* **client:** make CardInspector overlap board JIRA-style (KA-113) ([#201](https://github.com/activadee/kanban-ai/issues/201)) ([75aab59](https://github.com/activadee/kanban-ai/commit/75aab5927248192b3f3344ece3fa670640df388a))
* **github:** make PR inline summary agent non-blocking ([#202](https://github.com/activadee/kanban-ai/issues/202)) ([3b18080](https://github.com/activadee/kanban-ai/commit/3b18080fb5f91df06b7c4e65320ebb2baf4c32de))
* persist ticket enhancement suggestions across reloads ([#200](https://github.com/activadee/kanban-ai/issues/200)) ([3d515b1](https://github.com/activadee/kanban-ai/commit/3d515b13bdebc7d0ace4e5ffb45317f22b1b6d5e))
* **server:** delete mismatched migration hashes and fail-safe alignment ([fe08596](https://github.com/activadee/kanban-ai/commit/fe08596f2b0956685c5cc029449ef4cbf284c19f))

### Bug Fixes

* **server:** harden migration reconciliation safety ([170d624](https://github.com/activadee/kanban-ai/commit/170d624bb26da0c5cd07ba39bc87eb54bdb9a1ef))

### CI

* refine semantic-release workflow triggers and validation ([#199](https://github.com/activadee/kanban-ai/issues/199)) ([3a6954c](https://github.com/activadee/kanban-ai/commit/3a6954c997c03a7bfda5ec511e1be8f4aae9434f))

## [0.11.1](https://github.com/activadee/kanban-ai/compare/v0.11.0...v0.11.1) (2025-11-30)

### Bug Fixes

* **server:** narrow migration hash access ([4eb7662](https://github.com/activadee/kanban-ai/commit/4eb76621fb27adae3f2dc1c9222e50afabc15415))

### Chores

* **server:** include expected count and positional tags in migration logs ([06e7b5f](https://github.com/activadee/kanban-ai/commit/06e7b5fa1c7c52692425f997f808bcbc10a20553))
* **server:** log applied migrations summary ([b1d2571](https://github.com/activadee/kanban-ai/commit/b1d257168c24d4f671505ffa0d17cc66badba67d))
* **server:** log migration application ([7b9c2ec](https://github.com/activadee/kanban-ai/commit/7b9c2eca26c8d3b6be42a446bc7edf09bca29c10))
* **server:** report migration hashes/tags after apply ([3cdf0f8](https://github.com/activadee/kanban-ai/commit/3cdf0f87731967dada91a318abe9c91b8d5fb1ab))

## [0.11.0](https://github.com/activadee/kanban-ai/compare/v0.10.3...v0.11.0) (2025-11-30)

### Features

* **tickets:** support conventional commit ticket types ([#198](https://github.com/activadee/kanban-ai/issues/198)) ([18407d9](https://github.com/activadee/kanban-ai/commit/18407d9b6a0f8eb0aff4a29dca8c809d98ad5e17))

## [0.10.3](https://github.com/activadee/kanban-ai/compare/v0.10.2...v0.10.3) (2025-11-30)

### Bug Fixes

* default CardInspector to Attempts tab when an attempt exists ([#197](https://github.com/activadee/kanban-ai/issues/197)) ([fdf6f90](https://github.com/activadee/kanban-ai/commit/fdf6f909dd77e4e6259e1974962ccce0bb486632))

### Chores

* update author ([6d22c54](https://github.com/activadee/kanban-ai/commit/6d22c54257dc68f3df62fe71230174f165cb2ba4))

## [0.10.2](https://github.com/activadee/kanban-ai/compare/v0.10.1...v0.10.2) (2025-11-30)

### Bug Fixes

* **cli:** pass binary version to server ([94ac7b6](https://github.com/activadee/kanban-ai/commit/94ac7b6528594a3a5b2280d2e4695af22b2ccd6b))

### Chores

* **release:** show all conventional commit types ([2ffea2e](https://github.com/activadee/kanban-ai/commit/2ffea2ec3e1665c12319abf1adda6a56eea2b272))

## [0.10.1](https://github.com/activadee/kanban-ai/compare/v0.10.0...v0.10.1) (2025-11-30)

### Bug Fixes

* **client:** clarify create & enhance dialog flow ([#195](https://github.com/activadee/kanban-ai/issues/195)) ([ccca8bc](https://github.com/activadee/kanban-ai/commit/ccca8bc061e8fa7989596220bd16aaf192d4e54f))

## [0.10.0](https://github.com/activadee/kanban-ai/compare/v0.9.1...v0.10.0) (2025-11-30)

### Features

* add in-app release check and update reminder banner ([#196](https://github.com/activadee/kanban-ai/issues/196)) ([ed6ab7b](https://github.com/activadee/kanban-ai/commit/ed6ab7b3a114d277c841c5bd665aecd3896f1b14))

## [0.9.1](https://github.com/activadee/kanban-ai/compare/v0.9.0...v0.9.1) (2025-11-30)

### Bug Fixes

* disable ticket menu interactions while card is disabled or enhancing ([#191](https://github.com/activadee/kanban-ai/issues/191)) ([13bc2a3](https://github.com/activadee/kanban-ai/commit/13bc2a34c70a2646de490b55133ef286f8c5db97))

## [0.9.0](https://github.com/activadee/kanban-ai/compare/v0.8.0...v0.9.0) (2025-11-30)

### Features

* **board:** add per-lane card menu and inline ticket enhancement ([#189](https://github.com/activadee/kanban-ai/issues/189)) ([72ba1a7](https://github.com/activadee/kanban-ai/commit/72ba1a793a230e98fd90822ef4314b7876dcab79))
* **board:** non-blocking AI ticket enhancement queue ([#187](https://github.com/activadee/kanban-ai/issues/187)) ([eae715f](https://github.com/activadee/kanban-ai/commit/eae715f4a48bc60436c9aceb46239b657343137a))

### Bug Fixes

* node version ([5a258cc](https://github.com/activadee/kanban-ai/commit/5a258ccd26b225b6191ded0c060ffd615ec0cb50))

# Changelog

All notable changes to this project will be documented in this file by semantic-release.

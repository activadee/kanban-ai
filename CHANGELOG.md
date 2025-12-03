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

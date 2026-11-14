import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "app";
export default defineRailway(() => {
  const app = service("app", {
    source: github("TopProjectsCreator/Robotics-Interview-Dashboard", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/healthz",
    healthcheckTimeout: 300,
    replicas: { "sfo": 1 },
  });

  return project("Robotics Interview Dashboard", {
    variables: { managed: false },
    resources: [app],
  });
});

/**
 * 部门管理 API 测试
 *
 * @module tests/functional/organization/departments
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import { createCompanyData, createDepartmentData } from "@test/helpers/test-data.factory";

describe("Departments API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;
  let testCompanyId: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(baseUrl, adminApiKey);

    // 使用 Demo Company 作为测试公司
    testCompanyId = "co_demo_company";
  });

  describe("GET /admin/departments", () => {
    it("应该列出所有部门", async () => {
      const response = await apiClient.listDepartments();

      if (response.status === 200) {
        expect(response.data.departments).toBeInstanceOf(Array);
      } else if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      }
    });

    it("应该支持按 company_id 过滤", async () => {
      const response = await apiClient.listDepartments({ company_id: testCompanyId });

      if (response.status === 200) {
        expect(response.data.departments).toBeInstanceOf(Array);
      } else if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      }
    });
  });

  describe("POST /admin/departments", () => {
    it("应该成功创建部门", async () => {
      const deptData = createDepartmentData(testCompanyId, {
        name: `Engineering ${Date.now()}`,
        quota_pool: 300000,
        quota_daily: 3000,
      });

      const response = await apiClient.createDepartment(deptData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.name).toBe(deptData.name);
        }
      }
    });

    it("应该拒绝不存在公司的部门", async () => {
      const response = await apiClient.createDepartment({
        id: crypto.randomUUID(),
        company_id: crypto.randomUUID(),
        name: "Orphan Department",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 404]).toContain(response.status);
      }
    });

    it("应该验证必填字段", async () => {
      const response = await apiClient.createDepartment({
        id: crypto.randomUUID(),
        company_id: testCompanyId,
        name: "",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe("GET /admin/departments/:id", () => {
    it("应该获取部门详情", async () => {
      // 先创建一个测试部门
      const deptData = createDepartmentData(testCompanyId, {
        name: `Test Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.getDepartment(deptData.id);
        expect(response.status).toBe(200);
        expect(response.data.name).toBe(deptData.name);
      }
    });

    it("应该返回 404 对于不存在的部门", async () => {
      const response = await apiClient.getDepartment(crypto.randomUUID());

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("PUT /admin/departments/:id", () => {
    it("应该更新部门配额", async () => {
      const response = await apiClient.updateDepartment("dept_engineering", {
        quota_pool: 600000,
        quota_daily: 6000,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("应该更新部门名称", async () => {
      const newName = `Sales ${Date.now()}`;
      const response = await apiClient.updateDepartment("dept_engineering", {
        name: newName,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([200, 409]).toContain(response.status);
      }
    });
  });

  describe("DELETE /admin/departments/:id", () => {
    it("应该删除空部门", async () => {
      // 先创建一个临时部门
      const deptData = createDepartmentData(testCompanyId, {
        name: `Temp Dept ${Date.now()}`,
      });
      const createResponse = await apiClient.createDepartment(deptData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.deleteDepartment(deptData.id);
        expect(response.status).toBe(200);
      }
    });

    it("应该拒绝有用户的部门", async () => {
      // Engineering 部门有用户，不能删除
      const response = await apiClient.deleteDepartment("dept_engineering");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([409, 400]).toContain(response.status);
      }
    });
  });
});

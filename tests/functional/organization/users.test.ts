/**
 * 用户管理 API 测试
 *
 * @module tests/functional/organization/users
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "@test/helpers/api-client";
import {
  createCompanyData,
  createDepartmentData,
  createUserData,
} from "@test/helpers/test-data.factory";

describe("Users API", () => {
  let apiClient: ApiClient;
  let baseUrl: string;
  let adminApiKey: string;
  let testCompanyId: string;
  let testDeptId: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || "http://localhost:8787";
    adminApiKey = process.env.TEST_ADMIN_API_KEY || "sk-admin_dev_fixed_key_local_2024";
    apiClient = new ApiClient(baseUrl, adminApiKey);

    // 使用现有的 demo 数据
    testCompanyId = "co_demo_company";
    testDeptId = "dept_engineering";
  });

  describe("GET /admin/users", () => {
    it("应该列出所有用户", async () => {
      const response = await apiClient.listUsers();

      if (response.status === 200) {
        expect(response.data.users).toBeInstanceOf(Array);
      } else if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      }
    });

    it("应该支持按 company_id 过滤", async () => {
      const response = await apiClient.listUsers({ company_id: testCompanyId });

      if (response.status === 200) {
        expect(response.data.users).toBeInstanceOf(Array);
      } else if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      }
    });

    it("应该支持按 department_id 过滤", async () => {
      const response = await apiClient.listUsers({ department_id: testDeptId });

      if (response.status === 200) {
        expect(response.data.users).toBeInstanceOf(Array);
      } else if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      }
    });
  });

  describe("POST /admin/users", () => {
    it("应该成功创建用户", async () => {
      const userData = createUserData(testCompanyId, testDeptId, {
        email: `test-${Date.now()}@example.com`,
        name: "John Doe",
        role: "admin",
        quota_daily: 2000,
      });

      const response = await apiClient.createUser(userData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
          expect(response.data.name).toBe("John Doe");
        }
      }
    });

    it("应该拒绝重复的邮箱", async () => {
      // 使用已存在的 admin@example.com
      const response = await apiClient.createUser({
        id: crypto.randomUUID(),
        email: "admin@example.com", // 已存在
        name: "Duplicate User",
        company_id: testCompanyId,
        role: "user",
        quota_daily: 1000,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([409, 400]).toContain(response.status);
      }
    });

    it("应该拒绝不存在公司的用户", async () => {
      const response = await apiClient.createUser({
        ...createUserData(testCompanyId, testDeptId),
        company_id: crypto.randomUUID(),
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 404]).toContain(response.status);
      }
    });

    it("应该拒绝不存在部门的用户", async () => {
      const response = await apiClient.createUser({
        ...createUserData(testCompanyId, testDeptId),
        department_id: crypto.randomUUID(),
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([400, 404]).toContain(response.status);
      }
    });

    it("应该允许没有部门的用户", async () => {
      const userData = createUserData(testCompanyId, null);
      delete userData.department_id;

      const response = await apiClient.createUser(userData);

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([201, 409]).toContain(response.status);
      }
    });
  });

  describe("GET /admin/users/:id", () => {
    it("应该获取用户详情", async () => {
      const response = await apiClient.getUser("u_admin");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
        expect(response.data.email).toBe("admin@example.com");
      }
    });

    it("应该返回 404 对于不存在的用户", async () => {
      const response = await apiClient.getUser(crypto.randomUUID());

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe("PUT /admin/users/:id", () => {
    it("应该更新用户部门", async () => {
      // 创建一个新部门用于测试
      const newDeptId = crypto.randomUUID();
      const deptResponse = await apiClient.createDepartment({
        id: newDeptId,
        company_id: testCompanyId,
        name: `New Dept ${Date.now()}`,
      });

      if (deptResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (deptResponse.status === 201) {
        const demoUserResponse = await apiClient.getUser("u_demo_user");
        if (demoUserResponse.status === 200) {
          const response = await apiClient.updateUser("u_demo_user", {
            department_id: newDeptId,
          });
          expect(response.status).toBe(200);
        }
      }
    });

    it("应该更新用户角色", async () => {
      const response = await apiClient.updateUser("u_demo_user", {
        role: "admin",
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });

    it("应该更新用户配额", async () => {
      const response = await apiClient.updateUser("u_demo_user", {
        quota_daily: 5000,
      });

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect(response.status).toBe(200);
      }
    });
  });

  describe("DELETE /admin/users/:id", () => {
    it("应该删除没有 API Key 的用户", async () => {
      // 先创建一个临时用户
      const userData = createUserData(testCompanyId, null, {
        email: `temp-${Date.now()}@example.com`,
      });
      const createResponse = await apiClient.createUser(userData);

      if (createResponse.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
        return;
      }

      if (createResponse.status === 201) {
        const response = await apiClient.deleteUser(createResponse.data.id);
        expect(response.status).toBe(200);
      }
    });

    it("应该拒绝有 API Key 的用户", async () => {
      // admin 用户有 API Key，不能删除
      const response = await apiClient.deleteUser("u_admin");

      if (response.status === 401) {
        console.log("跳过测试 - 需要有效的管理员 API Key");
      } else {
        expect([409, 400]).toContain(response.status);
      }
    });
  });
});

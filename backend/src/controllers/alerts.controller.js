import { z } from 'zod';
import * as service from '../services/alerts.service.js';
import { ok } from '../utils/errors.js';
const id = (req) =>
  z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .parse(req.params.id);
export const list = async (req, res) => ok(res, await service.listAlerts(req.userId));
export const create = async (req, res) =>
  ok(res, await service.createAlert(req.userId, req.body), 201);
export const remove = async (req, res) => ok(res, await service.deleteAlert(req.userId, id(req)));
export const notifications = async (req, res) =>
  ok(res, await service.listNotifications(req.userId));
export const read = async (req, res) => ok(res, await service.markRead(req.userId, id(req)));

--[[
	Minimal stub of the Teardown Lua API: just enough to run exhibit.lua offline under Lua 5.1.
	Math functions follow Teardown's documented semantics (vectors/quaternions are plain arrays,
	quaternions are {x, y, z, w}, angles in degrees). QuatEuler applies X, then Z, then Y
	(the same order the web viewer uses: three.js Euler order 'YZX').

	The scene (bodies, shapes, locations, tags, transforms) is registered from Python with
	STUB.addBody / STUB.addShape / STUB.addLocation. Input and the raycast target are set by the
	test through STUB.press / STUB.lookAt.
]]

STUB = {
	entities = {},     -- handle -> {kind, tags = {k = v}, t = transform (world for body/location, local for shape), body}
	nextHandle = 1,
	pressed = {},      -- action -> true for the next InputPressed
	look = 0,          -- shape handle the raycast returns
	emissive = {},     -- shape handle -> scale
	outlines = 0,
	sounds = 0,
	calls = {SetBodyTransform = 0, QueryRaycast = 0, Find = 0},
}

local sqrt, sin, cos, acos, rad, deg = math.sqrt, math.sin, math.cos, math.acos, math.rad, math.deg

-- ------------------------------------------------------------------ vectors
function Vec(x, y, z) return {x or 0, y or 0, z or 0} end
function VecCopy(v) return {v[1], v[2], v[3]} end
function VecAdd(a, b) return {a[1] + b[1], a[2] + b[2], a[3] + b[3]} end
function VecSub(a, b) return {a[1] - b[1], a[2] - b[2], a[3] - b[3]} end
function VecScale(a, s) return {a[1] * s, a[2] * s, a[3] * s} end
function VecDot(a, b) return a[1] * b[1] + a[2] * b[2] + a[3] * b[3] end
function VecCross(a, b) return {a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1]} end
function VecLength(a) return sqrt(VecDot(a, a)) end
function VecNormalize(a) local l = VecLength(a) if l < 1e-12 then return {0, 0, 0} end return VecScale(a, 1 / l) end
function VecLerp(a, b, t) return {a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t} end

-- ------------------------------------------------------------------ quaternions {x, y, z, w}
function Quat(x, y, z, w)
	if x == nil then return {0, 0, 0, 1} end
	return {x, y, z, w}
end
function QuatAxisAngle(axis, angleDeg)
	local n = VecNormalize(axis)
	local h = rad(angleDeg) / 2
	local s = sin(h)
	return {n[1] * s, n[2] * s, n[3] * s, cos(h)}
end
function QuatRotateQuat(a, b) -- a * b  (apply b, then a)
	local ax, ay, az, aw = a[1], a[2], a[3], a[4]
	local bx, by, bz, bw = b[1], b[2], b[3], b[4]
	return {
		aw * bx + ax * bw + ay * bz - az * by,
		aw * by - ax * bz + ay * bw + az * bx,
		aw * bz + ax * by - ay * bx + az * bw,
		aw * bw - ax * bx - ay * by - az * bz,
	}
end
function QuatEuler(x, y, z)
	local qx = QuatAxisAngle({1, 0, 0}, x or 0)
	local qy = QuatAxisAngle({0, 1, 0}, y or 0)
	local qz = QuatAxisAngle({0, 0, 1}, z or 0)
	return QuatRotateQuat(qy, QuatRotateQuat(qz, qx))
end
function QuatRotateVec(q, v)
	local qv = {q[1], q[2], q[3]}
	local t = VecScale(VecCross(qv, v), 2)
	return VecAdd(VecAdd(v, VecScale(t, q[4])), VecCross(qv, t))
end
local function qconj(q) return {-q[1], -q[2], -q[3], q[4]} end
function QuatSlerp(a, b, t)
	local d = a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4]
	local bb = b
	if d < 0 then d = -d bb = {-b[1], -b[2], -b[3], -b[4]} end
	local k0, k1
	if d > 0.9995 then
		k0, k1 = 1 - t, t
	else
		local th = acos(d)
		local s = sin(th)
		k0, k1 = sin((1 - t) * th) / s, sin(t * th) / s
	end
	local r = {a[1] * k0 + bb[1] * k1, a[2] * k0 + bb[2] * k1, a[3] * k0 + bb[3] * k1, a[4] * k0 + bb[4] * k1}
	local l = sqrt(r[1] ^ 2 + r[2] ^ 2 + r[3] ^ 2 + r[4] ^ 2)
	return {r[1] / l, r[2] / l, r[3] / l, r[4] / l}
end

-- ------------------------------------------------------------------ transforms
function Transform(pos, rot) return {pos = pos or {0, 0, 0}, rot = rot or {0, 0, 0, 1}} end
function TransformCopy(t) return {pos = VecCopy(t.pos), rot = {t.rot[1], t.rot[2], t.rot[3], t.rot[4]}} end
function TransformToParentTransform(parent, child)
	return {pos = VecAdd(parent.pos, QuatRotateVec(parent.rot, child.pos)), rot = QuatRotateQuat(parent.rot, child.rot)}
end
function TransformToLocalTransform(parent, t)
	local inv = qconj(parent.rot)
	return {pos = QuatRotateVec(inv, VecSub(t.pos, parent.pos)), rot = QuatRotateQuat(inv, t.rot)}
end
function TransformToParentPoint(t, p) return VecAdd(t.pos, QuatRotateVec(t.rot, p)) end
function TransformToLocalPoint(t, p) return QuatRotateVec(qconj(t.rot), VecSub(p, t.pos)) end
function TransformToParentVec(t, v) return QuatRotateVec(t.rot, v) end
function TransformToLocalVec(t, v) return QuatRotateVec(qconj(t.rot), v) end

-- ------------------------------------------------------------------ scene registry
local function add(kind, tags, t, body)
	local h = STUB.nextHandle
	STUB.nextHandle = h + 1
	STUB.entities[h] = {kind = kind, tags = tags or {}, t = t, body = body}
	return h
end
function STUB.addBody(tags, pos) return add("body", tags, Transform(pos)) end
function STUB.addShape(body, tags, pos) return add("shape", tags, Transform(pos), body) end
function STUB.addLocation(tags, pos) return add("location", tags, Transform(pos)) end

local function find(kind, tag)
	STUB.calls.Find = STUB.calls.Find + 1
	local out = {}
	for h = 1, STUB.nextHandle - 1 do
		local e = STUB.entities[h]
		if e.kind == kind and e.tags[tag] ~= nil then out[#out + 1] = h end
	end
	return out
end
function FindBodies(tag, global) return find("body", tag) end
function FindShapes(tag, global) return find("shape", tag) end
function FindLocations(tag, global) return find("location", tag) end
function FindBody(tag, global) return find("body", tag)[1] or 0 end
function FindShape(tag, global) return find("shape", tag)[1] or 0 end
function FindLocation(tag, global) return find("location", tag)[1] or 0 end
function GetTagValue(h, tag) local e = STUB.entities[h] return e and e.tags[tag] or "" end
function HasTag(h, tag) local e = STUB.entities[h] return e ~= nil and e.tags[tag] ~= nil end

function GetLocationTransform(h) return TransformCopy(STUB.entities[h].t) end
function GetBodyTransform(h) return TransformCopy(STUB.entities[h].t) end
function SetBodyTransform(h, t)
	STUB.calls.SetBodyTransform = STUB.calls.SetBodyTransform + 1
	STUB.entities[h].t = TransformCopy(t)
end
function GetShapeLocalTransform(h) return TransformCopy(STUB.entities[h].t) end
function SetShapeLocalTransform(h, t) STUB.entities[h].t = TransformCopy(t) end
function GetShapeBody(h) return STUB.entities[h].body end
function GetShapeWorldTransform(h)
	local e = STUB.entities[h]
	return TransformToParentTransform(STUB.entities[e.body].t, e.t)
end
function SetBodyDynamic() end
function IsBodyDynamic() return false end
function SetShapeEmissiveScale(h, s) STUB.emissive[h] = s end
function DrawShapeOutline() STUB.outlines = STUB.outlines + 1 end
function DrawShapeHighlight() end

-- ------------------------------------------------------------------ player, input, queries
function GetPlayerCameraTransform() return Transform({0.6, 1.7, 2.3}, {0, 0, 0, 1}) end
function QueryRaycast(origin, dir, maxDist)
	STUB.calls.QueryRaycast = STUB.calls.QueryRaycast + 1
	if STUB.look ~= 0 then return true, 1.0, {0, 1, 0}, STUB.look end
	return false, maxDist, {0, 0, 0}, 0
end
function InputPressed(action)
	local p = STUB.pressed[action]
	STUB.pressed[action] = nil
	return p == true
end
function InputDown() return false end

-- ------------------------------------------------------------------ sound, ui, debug (no-ops)
function LoadSound(path) return 7 end
function PlaySound() STUB.sounds = STUB.sounds + 1 end
function UiPush() end
function UiPop() end
function UiTranslate() end
function UiAlign() end
function UiFont() end
function UiColor() end
function UiText(s) return 100, 20 end
function UiRect() end
function UiWordWrap() end
function UiWidth() return 1920 end
function UiHeight() return 1080 end
function UiCenter() return 960 end
function UiMiddle() return 540 end
function UiGetTextSize() return 200, 24 end
function DebugPrint(s) STUB.lastDebug = tostring(s) end
function DebugWatch() end
